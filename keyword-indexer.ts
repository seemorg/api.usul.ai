import { db } from '@/lib/db';
import type { SandboxedJob } from 'bullmq';
import { KeywordIndexerQueueData } from '@/queues/keyword-indexer/queue';
import { fetchBookContent } from '@/book-fetchers';
import { preparePages } from '@/vector/splitters/v1/metadata';
import { chunk } from '@/lib/utils';
import { keywordSearchClient } from '@/lib/keyword-search';

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
    select: { id: true, flags: true, versions: true },
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
      flags: {
        ...book.flags,
        keywordSupported: true,
        keywordVersion: versionId,
      } as PrismaJson.BookFlags,
    },
  });
};

export default async function keywordProcessor(
  job: SandboxedJob<KeywordIndexerQueueData>,
) {
  const { id, versionId } = job.data;

  const book = await db.book.findFirst({
    where: { id },
    select: { id: true, versions: true, flags: true, author: { select: { id: true } } },
  });

  if (!book) {
    throw new Error(`Book not found: ${id}`);
  }

  const versionToIndex = book.versions.find(v => v.value === versionId);
  if (!versionToIndex) {
    throw new Error(`Version not found: ${versionId}`);
  }

  const bookContent = await fetchBookContent(book, versionToIndex.value);
  if (!bookContent || bookContent.source === 'external') {
    throw new Error(`Book content not found: ${id}`);
  }

  let preparedPages: ReturnType<typeof preparePages>;
  if (bookContent.source === 'turath') {
    preparedPages = preparePages(
      bookContent.turathResponse.pages,
      bookContent.turathResponse.headings,
      {
        preprocessUsingSplitter: false,
        shouldRemoveDiacritics: false,
      },
    );
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
}
