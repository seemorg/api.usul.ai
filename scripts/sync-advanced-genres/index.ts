import { db } from '@/lib/db';
import { genresAirtable } from './airtable';
import { translateAndTransliterateName } from './openai';
import slugify from 'slugify';

const getAirtableAdvancedGenres = async () => {
  return (await genresAirtable('Advanced Genres').select().all()).map(g => {
    const fields = g.fields;
    const name = fields['Name'] as string;
    const simpleGenreId = (fields['Merging Genre'] as string[]) ?? [];

    return {
      _airtableReference: g.id,
      name,
      simpleGenreId: simpleGenreId[0] ?? null,
    };
  });
};

const simpleGenres = await db.genre.findMany({
  select: {
    id: true,
    extraProperties: true,
  },
});

const airtableAdvancedGenres = await getAirtableAdvancedGenres();
const existingAdvancedGenres = await db.advancedGenre.findMany({
  select: {
    extraProperties: true,
    slug: true,
  },
});
const existingAdvancedGenresSet = new Set(
  existingAdvancedGenres.map(g => g.extraProperties._airtableReference),
);

const existingSlugs = new Set(existingAdvancedGenres.map(g => g.slug));

let count = 0;
for (const advancedGenre of airtableAdvancedGenres) {
  console.log(`Processing ${++count} of ${airtableAdvancedGenres.length}`);

  if (existingAdvancedGenresSet.has(advancedGenre._airtableReference)) {
    console.log('Skipping because it already exists');
    continue;
  }

  const englishName = await translateAndTransliterateName(
    'genre',
    advancedGenre.name,
    'en-US',
  );

  if (!englishName) {
    continue;
  }

  let slug = slugify(englishName.translation, { lower: true, trim: true });
  let suffix = 1;
  while (existingSlugs.has(slug)) {
    slug = slugify(`${englishName.translation}-${suffix++}`, { lower: true, trim: true });
  }

  existingSlugs.add(slug);

  const simpleGenre = simpleGenres.find(
    g => g.extraProperties._airtableReference === advancedGenre.simpleGenreId,
  );

  try {
    await db.advancedGenre.create({
      data: {
        id: slug,
        slug,
        transliteration: englishName.transliteration,
        nameTranslations: {
          createMany: {
            data: [
              {
                locale: 'en',
                text: englishName.translation,
              },
              {
                locale: 'ar',
                text: advancedGenre.name,
              },
            ],
          },
        },
        extraProperties: {
          _airtableReference: advancedGenre._airtableReference,
          ...(simpleGenre ? { simpleGenreId: simpleGenre.id } : {}),
        },
      },
    });
  } catch (e) {
    console.log(e);
    continue;
  }
}
