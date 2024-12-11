import { Worker } from 'bullmq';

import type { KeywordIndexerQueueData } from './queue';
import { KEYWORD_INDEXER_QUEUE_NAME, KEYWORD_INDEXER_QUEUE_REDIS } from './queue';
import { chunk } from '@/lib/utils';
import { keywordSearchClient } from '@/lib/keyword-search';
import { preparePages } from '@/vector/splitters/v1/metadata';
import { fetchBookContent } from '@/book-fetchers';
import { getBookById } from '@/services/book';
import { db } from '@/lib/db';

const makeId = (
  bookId: string,
  versionSource: string,
  versionId: string,
  index: number,
) =>
  Buffer.from(`${bookId}:${versionSource}:${versionId}:${index}`).toString('base64url');

const updateBookFlags = async (id: string, versionId: string) => {
  const book = await db.book.findUnique({
    where: { id },
    select: { id: true, versions: true },
  });

  if (!book) {
    throw new Error(`Book not found: ${id}`);
  }

  // update book flags
  await db.book.update({
    where: {
      id: book.id,
    },
    data: {
      versions: book.versions.map(version => ({
        ...version,
        ...(version.id === versionId ? { keywordSupported: true } : {}),
      })),
    },
  });
};

export const worker = new Worker<KeywordIndexerQueueData>(
  KEYWORD_INDEXER_QUEUE_NAME,
  async job => {
    const { id, versionId } = job.data;

    const book = await getBookById(id);

    if (!book) {
      throw new Error(`Book not found: ${id}`);
    }

    const versionToIndex = book.versions.find(v => v.id === versionId);
    if (!versionToIndex) {
      throw new Error(`Version not found: ${versionId}`);
    }

    const bookContent = await fetchBookContent(
      {
        id: book.id,
        author: { id: book.author!.id },
        versions: book.versions,
      },
      versionToIndex.value,
    );

    if (
      !bookContent ||
      bookContent.source === 'external' ||
      bookContent.source === 'pdf'
    ) {
      throw new Error(`Book content not found: ${id}`);
    }

    let preparedPages: ReturnType<typeof preparePages>;
    if (bookContent.source === 'turath') {
      preparedPages = preparePages(bookContent.pages, bookContent.headings, {
        preprocessUsingSplitter: false,
        shouldRemoveDiacritics: false,
      });
    } else {
      // version.source === 'openiti'
      preparedPages = preparePages(bookContent.content, bookContent.chapters, {
        preprocessUsingSplitter: false,
        shouldRemoveDiacritics: false,
      });
    }

    const batches = chunk(preparedPages, 100);
    for (const batch of batches) {
      await keywordSearchClient.mergeOrUploadDocuments(
        batch.map(p => {
          return {
            id: makeId(book.id, versionToIndex.source, versionId, p.index),
            book_id: book.id,
            book_version_id: `${versionToIndex.source}:${versionId}`,
            content: p.text,
            chapters: p.chaptersIndices,
            page: p.page!,
            volume: p.volume ? String(p.volume) : null,
            index: p.index,
          };
        }),
      );
    }

    await updateBookFlags(id, versionId);

    return { status: 'success', id, versionId };
  },
  {
    connection: KEYWORD_INDEXER_QUEUE_REDIS,
    concurrency: 10,
    lockDuration: 1000 * 60 * 40, // 40 minutes
  },
);
