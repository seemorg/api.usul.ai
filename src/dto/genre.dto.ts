import { PathLocale } from '@/lib/locale';
import { getPrimaryLocalizedText, getSecondaryLocalizedText } from '@/lib/localization';
import { Genre, GenreName } from '@prisma/client';

export type GenreDto = ReturnType<typeof makeGenreDto>;

export const makeGenreDto = (
  genre: Genre & { nameTranslations: GenreName[] },
  locale: PathLocale,
) => {
  return {
    id: genre.id,
    slug: genre.slug,
    transliteration: genre.transliteration,
    numberOfBooks: genre.numberOfBooks,
    name: getPrimaryLocalizedText(genre.nameTranslations, locale),
    secondaryName: getSecondaryLocalizedText(genre.nameTranslations, locale),
  };
};
