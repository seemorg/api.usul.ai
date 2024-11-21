import { db } from '@/lib/db';
import type { SandboxedJob } from 'bullmq';
import type { BookQueueData } from '@/queues/ai-indexer/queue';
import { indexBook } from '@/vector/splitters/v1';

const updateBookFlags = async (
  book: {
    id: string;
    flags: PrismaJson.BookFlags;
  },
  versionId: string,
) => {
  // update book flags
  await db.book.update({
    where: {
      id: book.id,
    },
    data: {
      flags: {
        ...book.flags,
        aiSupported: true,
        aiVersion: versionId,
      } as PrismaJson.BookFlags,
    },
  });
};

export default async function booksProcessor(job: SandboxedJob<BookQueueData>) {
  const { id, versionId } = job.data;
  const book = await db.book.findUnique({
    where: { id },
    select: { id: true, flags: true, versions: true },
  });

  if (!book) {
    throw new Error(`Book not found: ${id}`);
  }

  if (!book.versions.some(v => v.value === versionId)) {
    throw new Error(`Version not found: ${versionId}`);
  }

  const result = await indexBook({ id, versionId });
  if (result.status !== 'success' && result.status !== 'skipped') {
    throw new Error(JSON.stringify(result));
  }

  if (result.status === 'success') {
    await updateBookFlags(book, result.versionId!);
  }

  return result;
}
