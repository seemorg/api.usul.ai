import { db } from '@/lib/db';
import { chunk } from '@/lib/utils';
import _uploadedVersions from '../../src/book-fetchers/uploaded-versions.json';
import { fetchTurathBook } from '@/book-fetchers/turath';
import { fetchOpenitiBook } from '@/book-fetchers/openiti';
import { uploadToR2 } from '@/lib/r2';
import { writeFile } from 'fs/promises';
import path from 'path';

const OUTPUT_PATH = path.join('src/book-fetchers', 'uploaded-versions.json');

const makeVersionKey = (source: string, value: string) =>
  `book-content/${source}/${value}.json`;

const uploadedVersions = _uploadedVersions as Record<string, boolean>;

const books = await db.book.findMany({
  select: {
    id: true,
    authorId: true,
    versions: true,
  },
});

const finalVersions = books.flatMap(book =>
  book.versions
    .filter(
      v =>
        (v.source === 'turath' || v.source === 'openiti') &&
        !uploadedVersions[makeVersionKey(v.source, v.value)],
    )
    .map(v => ({
      ...v,
      bookId: book.id,
      authorId: book.authorId,
    })),
);

const batches = chunk(finalVersions, 10);
let i = 0;
for (const batch of batches) {
  console.log(`Uploading ${++i} / ${batches.length}`);

  await Promise.all(
    batch.map(async v => {
      const key = makeVersionKey(v.source, v.value);

      try {
        let content: object;
        if (v.source === 'turath') {
          content = await fetchTurathBook(v.value);
        } else if (v.source === 'openiti') {
          content = await fetchOpenitiBook({
            authorId: v.authorId,
            bookId: v.bookId,
            version: v.value,
          });
        } else {
          throw new Error(`Unknown source: ${v.source}`);
        }

        await uploadToR2(key, Buffer.from(JSON.stringify(content)), {
          contentType: 'application/json',
        });
        uploadedVersions[key] = true;
      } catch (e) {
        console.error(`Error uploading ${key}`);
      }
    }),
  );

  // write to file every 10 batches
  if (i % 10 === 0) {
    await writeFile(OUTPUT_PATH, JSON.stringify(uploadedVersions, null, 2));
  }
}

await writeFile(OUTPUT_PATH, JSON.stringify(uploadedVersions, null, 2));
console.log('Done');
