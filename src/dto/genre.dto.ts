import { PathLocale } from '@/lib/locale';
import { getPrimaryLocalizedText, getSecondaryLocalizedText } from '@/lib/localization';
import { Genre, GenreName } from '@prisma/client';

export type GenreDto = ReturnType<typeof makeGenreDto>;

export const makeGenreDto = (
  genre: Genre & { nameTranslations: GenreName[] },
  locale: PathLocale,
) => {
  const name = getPrimaryLocalizedText(genre.nameTranslations, locale);
  return {
    id: genre.id,
    slug: genre.slug,
    numberOfBooks: genre.numberOfBooks,
    name: locale === 'en' && genre.transliteration ? genre.transliteration : name,
    secondaryName: getSecondaryLocalizedText(genre.nameTranslations, locale),
  };
};
