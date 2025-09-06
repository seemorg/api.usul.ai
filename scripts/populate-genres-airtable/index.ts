import { db } from '@/lib/db';
import { genresAirtable } from '../sync-advanced-genres/airtable';
import { chunk } from '@/lib/utils';
import { LocalizedEntry } from '@/types/typesense/localized-entry';

const getAirtableAdvancedGenres = async () => {
  return (await genresAirtable('Advanced Genres').select().all()).reduce(
    (acc, g) => {
      const fields = g.fields;
      const name = fields['Name'] as string;

      acc[name] = g.id;
      return acc;
    },
    {} as Record<string, string>,
  );
};

const main = async () => {
  const genres = await getAirtableAdvancedGenres();
  const advancedGenreIds = Object.values(genres);

  const books = await db.book.findMany({
    select: {
      id: true,
      slug: true,
      genres: {
        select: {
          id: true,
          nameTranslations: { where: { locale: { in: ['ar', 'en'] } } },
        },
      },
      advancedGenres: {
        select: {
          id: true,
          nameTranslations: { where: { locale: { in: ['ar', 'en'] } } },
          extraProperties: true,
        },
      },
      primaryNameTranslations: { where: { locale: { in: ['ar', 'en'] } } },
    },
  });

  const getArabicText = (b: LocalizedEntry[]) => {
    return b.find(t => t.locale === 'ar')?.text || b[0]?.text;
  };

  const batches = chunk(books, 10);
  let i = 0;
  for (const batch of batches) {
    console.log(`Processing batch ${++i} / ${batches.length}`);

    // insert this into "Genre population" airtable
    await genresAirtable('Genre population')
      .create(
        batch.map(b => {
          return {
            fields: {
              'Book id': b.id,
              'Book name': getArabicText(b.primaryNameTranslations),
              'Book Url': `https://usul.ai/t/${b.slug}`,
              'Book Internal Url': `https://ocr.usul.ai/usul/texts/${b.id}/edit`,
              Genres: b.genres
                .map(g => getArabicText(g.nameTranslations))
                .filter(Boolean)
                .join(', '),
              'Advanced Genres': b.advancedGenres
                .map(
                  g =>
                    genres[getArabicText(g.nameTranslations)] ||
                    advancedGenreIds.find(
                      id => id === g.extraProperties._airtableReference,
                    )!,
                )
                .filter(Boolean),
            },
          };
        }),
      )
      .catch(e => {
        console.log(e);
      });
  }
};

main();
