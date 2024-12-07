import { db } from '@/lib/db';
import oldBooks from './book.json';
import { chunk } from '@/lib/utils';

const oldBooksMap = new Map(
  (oldBooks as { id: string; slug: string }[]).map(book => [book.id, book.slug]),
);

const books = await db.book.findMany({
  select: {
    id: true,
    slug: true,
  },
});

const alternateBooksSlugs: Record<string, string> = {};
for (const book of books) {
  if (!oldBooksMap.has(book.id)) continue;

  const oldSlug = oldBooksMap.get(book.id);
  if (oldSlug !== book.slug) {
    alternateBooksSlugs[book.id] = oldSlug!;
  }
}

const batches = chunk(Object.entries(alternateBooksSlugs), 100);
let i = 0;
for (const batch of batches) {
  console.log(`Processing batch ${++i} / ${batches.length}`);

  await db.bookAlternateSlug.createMany({
    data: batch.map(([bookId, alternateSlug]) => ({
      bookId,
      slug: alternateSlug,
    })),
  });
}

console.log('Done');
