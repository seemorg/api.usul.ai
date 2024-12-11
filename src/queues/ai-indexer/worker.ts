import { Worker } from 'bullmq';

import type { BookQueueData } from './queue';
import { BOOKS_QUEUE_NAME, BOOKS_QUEUE_REDIS } from './queue';
import { db } from '@/lib/db';
import { indexBook } from '@/vector/splitters/v1';

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
        ...(version.id === versionId ? { aiSupported: true } : {}),
      })),
    },
  });
};

export const worker = new Worker<BookQueueData>(
  BOOKS_QUEUE_NAME,
  async job => {
    const { id, versionId } = job.data;

    const result = await indexBook({ id, versionId });
    if (result.status !== 'success' && result.status !== 'skipped') {
      throw new Error(JSON.stringify(result));
    }

    if (result.status === 'success') {
      await updateBookFlags(id, result.versionId!);
    }

    return result;
  },
  {
    connection: BOOKS_QUEUE_REDIS,
    concurrency: 5,
    lockDuration: 1000 * 60 * 40, // 40 minutes
    // stalledInterval: 1000 * 60 * 40, // 40 minutes
  },
);
