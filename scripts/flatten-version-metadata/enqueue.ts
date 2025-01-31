import { db } from '@/lib/db';
import { chunk } from '@/lib/utils';
import { flattenMetadataQueue } from '@/queues/flatten-metadata/queue';

const main = async () => {
  const books = await db.book.findMany({
    select: {
      id: true,
      versions: true,
    },
  });

  // if it has turath or openiti version, enqueue it
  const booksToEnqueue = books.filter(book =>
    book.versions.some(
      // version => version.source === 'openiti' || version.source === 'turath',
      version => version.source === 'turath',
    ),
  );

  const batches = chunk(booksToEnqueue, 50);
  let i = 0;

  for (const batch of batches) {
    console.log(`Enqueuing batch ${++i} / ${batches.length}`);

    await flattenMetadataQueue.addBulk(
      batch.map(book => ({
        name: book.id,
        data: { bookId: book.id },
      })),
    );
  }
};

main();
