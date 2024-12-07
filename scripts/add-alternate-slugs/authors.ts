import { db } from '@/lib/db';
import oldAuthors from './author.json';
import { chunk } from '@/lib/utils';

const oldAuthorsMap = new Map(
  (oldAuthors as { id: string; slug: string }[]).map(author => [author.id, author.slug]),
);

const authors = await db.author.findMany({
  select: {
    id: true,
    slug: true,
  },
});

const alternateAuthorsSlugs: Record<string, string> = {};
for (const author of authors) {
  if (!oldAuthorsMap.has(author.id)) continue;

  const oldSlug = oldAuthorsMap.get(author.id);
  if (oldSlug !== author.slug) {
    alternateAuthorsSlugs[author.id] = oldSlug!;
  }
}

const batches = chunk(Object.entries(alternateAuthorsSlugs), 100);
let i = 0;

for (const batch of batches) {
  console.log(`Processing batch ${++i} / ${batches.length}`);

  await db.authorAlternateSlug.createMany({
    data: batch.map(([authorId, alternateSlug]) => ({
      authorId,
      slug: alternateSlug,
    })),
  });
}

console.log('Done');
