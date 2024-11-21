import { db } from '@/lib/db';
import { chunk } from '@/lib/utils';
import { booksQueue } from '@/queues/ai-indexer/queue';

const books = await db.book.findMany({
  select: {
    id: true,
    versions: true,
    flags: true,
  },
});

// get already indexed books so that we can index them
const booksToIndex = books.filter(
  book =>
    book.versions.length > 0 &&
    book.flags.aiSupported &&
    book.flags.aiVersion &&
    book.id !== '0256Bukhari.Sahih', // we already indexed this book
);

const batches = chunk(booksToIndex, 10);

let i = 0;
for (const batch of batches) {
  console.log(`Enqueuing batch ${++i} / ${batches.length}`);
  await booksQueue.addBulk(
    batch.map(book => ({
      name: `index-book-${book.id}`,
      data: { id: book.id, versionId: book.flags.aiVersion! },
    })),
  );
}

console.log('Done!');
