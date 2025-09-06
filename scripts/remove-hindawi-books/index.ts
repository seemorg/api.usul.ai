import { db } from '@/lib/db';
import { removeFromR2 } from '@/lib/r2';
import { chunk } from '@/lib/utils';
import _uploadedVersions from '../../src/book-fetchers/uploaded-versions.json';
import fs from 'fs/promises';
import path from 'path';
import { vectorSearchClient, keywordSearchClient } from '@/book-search/client';
import { odata } from '@azure/search-documents';

const uploadedVersions = _uploadedVersions as Record<string, boolean>;
const OUTPUT_PATH = path.join('src/book-fetchers', 'uploaded-versions.json');

const main = async () => {
  const books = await db.book.findMany({
    where: {
      numberOfVersions: 1,
    },
  });

  const hindawiBooks = books.filter(
    book =>
      book.versions.length > 0 &&
      book.versions[0].source === 'openiti' &&
      book.versions[0].value.includes('.Hindawi'),
  );
  console.log(`Found ${hindawiBooks.length} hindawi books`);

  const batches = chunk(hindawiBooks, 10);
  let i = 0;
  for (const batch of batches) {
    console.log(`Deleting batch ${++i} / ${batches.length}`);
    let writeFile = false;

    // remove images from r2
    await Promise.all(
      batch.map(async book => {
        const key = book.coverImageUrl?.replace('https://assets.usul.ai/', '');
        if (key) await removeFromR2(key);
      }),
    );

    // remove from uploaded versions
    await Promise.all(
      batch.map(async book => {
        const key = `book-content/openiti/${book.versions[0].value}.json`;
        if (uploadedVersions[key]) {
          delete uploadedVersions[key];
          await removeFromR2(key);
          writeFile = true;
        }
      }),
    );

    // remove from Azure Cognitive Search indices (keyword and vector)
    try {
      const bookIds = batch.map(book => book.id);
      const filter = odata`search.in(book_id, '${bookIds.join(', ')}')`;

      const collectIds = async (client: any) => {
        const results = await client.search('*', {
          filter,
          select: ['id'],
          top: 1000,
          includeTotalCount: false,
        });
        const ids: string[] = [];
        for await (const r of results.results) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ids.push((r.document as any).id as string);
        }
        return ids;
      };

      const [keywordIds, vectorIds] = await Promise.all([
        collectIds(keywordSearchClient),
        collectIds(vectorSearchClient),
      ]);

      const deleteInChunks = async (client: any, ids: string[]) => {
        if (!ids.length) return;
        for (const idsChunk of chunk(ids, 1000)) {
          await client.deleteDocuments('id', idsChunk);
        }
      };

      await Promise.all([
        deleteInChunks(keywordSearchClient, keywordIds),
        deleteInChunks(vectorSearchClient, vectorIds),
      ]);
    } catch (err) {
      console.error('Failed to delete from search indices', err);
    }

    // remove from database
    await db.book.deleteMany({
      where: {
        id: { in: batch.map(book => book.id) },
      },
    });

    if (writeFile) {
      await fs.writeFile(OUTPUT_PATH, JSON.stringify(uploadedVersions, null, 2));
    }
  }
};

main();
