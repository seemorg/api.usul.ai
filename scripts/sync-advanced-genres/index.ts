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
    id: true,
    extraProperties: true,
    slug: true,
    nameTranslations: {
      where: {
        locale: 'ar',
      },
    },
  },
});
const existingAdvancedGenresSet = new Set(
  existingAdvancedGenres.map(g => g.extraProperties._airtableReference),
);

const existingSlugs = new Set(existingAdvancedGenres.map(g => g.slug));

let count = 0;
for (const advancedGenre of airtableAdvancedGenres) {
  console.log(`Processing ${++count} of ${airtableAdvancedGenres.length}`);

  let type: 'update' | 'create' = 'create';
  let existingAdvancedGenreToUpdate: (typeof existingAdvancedGenres)[number] | null =
    null;
  if (existingAdvancedGenresSet.has(advancedGenre._airtableReference)) {
    // check if arabic name is changed
    const existingAdvancedGenre = existingAdvancedGenres.find(
      g => g.extraProperties._airtableReference === advancedGenre._airtableReference,
    );
    const arabicName = existingAdvancedGenre?.nameTranslations[0]?.text;

    if (existingAdvancedGenre && arabicName !== advancedGenre.name) {
      type = 'update';
      existingAdvancedGenreToUpdate = existingAdvancedGenre;
    } else {
      continue;
    }
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

  if (type === 'create') {
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
  } else {
    console.dir(existingAdvancedGenreToUpdate, { depth: null });

    try {
      await db.advancedGenre.update({
        where: { id: existingAdvancedGenreToUpdate!.id },
        data: {
          transliteration: englishName.transliteration,
          slug,
          nameTranslations: {
            upsert: [
              {
                where: {
                  genreId_locale: {
                    genreId: existingAdvancedGenreToUpdate!.id,
                    locale: 'en',
                  },
                },
                create: {
                  locale: 'en',
                  text: englishName.translation,
                },
                update: {
                  text: englishName.translation,
                },
              },
              {
                where: {
                  genreId_locale: {
                    genreId: existingAdvancedGenreToUpdate!.id,
                    locale: 'ar',
                  },
                },
                create: {
                  locale: 'ar',
                  text: advancedGenre.name,
                },
                update: {
                  text: advancedGenre.name,
                },
              },
            ],
          },
          extraProperties: {
            ...(existingAdvancedGenreToUpdate!.extraProperties ?? {}),
            ...(simpleGenre ? { simpleGenreId: simpleGenre.id } : {}),
          },
        },
      });
    } catch (e) {
      console.log(e);
      continue;
    }
  }
}

// // Check for deleted genres
// const deletedGenres = existingAdvancedGenres.filter(
//   existingGenre =>
//     existingGenre.extraProperties._airtableReference &&
//     !airtableAdvancedGenres.some(
//       airtableGenre =>
//         airtableGenre._airtableReference ===
//         existingGenre.extraProperties._airtableReference,
//     ),
// );

// if (deletedGenres.length > 0) {
//   console.log(`Found ${deletedGenres.length} deleted genres`);

//   for (const deletedGenre of deletedGenres) {
//     console.log(
//       `Genre ${deletedGenre.nameTranslations[0]?.text} was deleted from Airtable`,
//     );
//     // Uncomment to actually delete from database:
//     // await db.advancedGenre.delete({
//     //   where: { slug: deletedGenre.slug }
//     // });
//   }
// }
