import { chunk } from '@/lib/utils';
import { db } from '@/lib/db';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import _turathAuthors from './turath_authors.json';
import _authorLinkingData from './author-linking-data.json';
import fs from 'fs';

const existingAuthorSlugs = new Map<string, string>(
  (
    await db.author.findMany({
      select: {
        id: true,
        slug: true,
        alternateSlugs: true,
      },
    })
  ).flatMap(
    author =>
      [
        [author.slug, author.id],
        ...author.alternateSlugs.map(alt => [alt.slug, author.id]),
      ] as [string, string][],
  ),
);

const authorSchema = z.object({
  turathId: z.number(),
  slug: z.string(),
  primaryNames: z.array(
    z.object({
      locale: z.string(),
      text: z.string(),
    }),
  ),
  variations: z.array(z.string()),
  transliteration: z.string(),
  bios: z.array(
    z.object({
      locale: z.string(),
      text: z.string(),
    }),
  ),
});

const authorLinkSchema = z.object({
  id: z.number(), // turathId
  arabicName: z.string(), // primaryName
  deathYear: z.number().nullable(),
  url: z.string().url().startsWith('https://app.turath.io/author/'),
  conflicts: z.array(z.string().url().startsWith('https://usul.ai/ar/author/')),
});

const authors = z.array(authorSchema).parse(_turathAuthors);
const authorLinkingData = z.array(authorLinkSchema).parse(_authorLinkingData);

const turathAuthorIdToLinkingData = authorLinkingData.reduce((acc, link) => {
  acc[link.id] = link;
  return acc;
}, {} as Record<number, z.infer<typeof authorLinkSchema>>);

const turathIdToUsulId: Record<number, string> = fs.existsSync('turathIdToUsulId.json')
  ? JSON.parse(fs.readFileSync('turathIdToUsulId.json', 'utf8'))
  : {};

// skip existing authors
const newAuthors = authors.filter(author => {
  if (turathIdToUsulId[author.turathId]) return false;

  const conflicts = turathAuthorIdToLinkingData[author.turathId]?.conflicts;
  if (!conflicts || conflicts.length === 0) return true;

  const usulSlug = conflicts[0].split('/').at(-1)?.trim();
  if (usulSlug) {
    turathIdToUsulId[author.turathId] = existingAuthorSlugs.get(usulSlug)!;
  }

  return false;
});

// SAFETY CHECK
const duplicateAuthors = newAuthors.filter(author =>
  existingAuthorSlugs.has(author.slug),
);

if (duplicateAuthors.length > 0) {
  console.dir(duplicateAuthors, { depth: null });
  console.log(duplicateAuthors.length);
  process.exit(0);
}

const turathAuthorsData = (
  (await (await fetch('https://files.turath.io/data-v3.json')).json()) as {
    authors: Record<number, { name: string; death: number | null; books: number[] }>;
  }
).authors;

const authorBatches = chunk(newAuthors, 5);
let i = 0;
for (const batch of authorBatches) {
  i++;
  console.log(`Processing batch ${i} / ${authorBatches.length}`);

  await db.$transaction(
    batch.map(author => {
      const id = createId();

      turathIdToUsulId[author.turathId] = id;

      return db.author.create({
        data: {
          id,
          slug: author.slug,
          year: turathAuthorsData[author.turathId]?.death ?? null,
          transliteration: author.transliteration,
          primaryNameTranslations: {
            createMany: {
              data: author.primaryNames.map(name => ({
                locale: name.locale,
                text: name.text,
              })),
            },
          },
          bioTranslations: {
            createMany: {
              data: author.bios.map(bio => ({
                locale: bio.locale,
                text: bio.text,
              })),
            },
          },
        },
      });
    }),
  );

  // save turathIdToUsulId to file
  fs.writeFileSync('turathIdToUsulId.json', JSON.stringify(turathIdToUsulId, null, 2));
}

console.log('Done');
