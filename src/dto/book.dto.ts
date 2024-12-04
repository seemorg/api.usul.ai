import { PathLocale } from '@/lib/locale';
import { getPrimaryLocalizedText, getSecondaryLocalizedText } from '@/lib/localization';
import { getAuthorById } from '@/services/author';
import { getGenreById } from '@/services/genre';
import { Book, BookOtherNames, BookPrimaryName } from '@prisma/client';

export type BookDto = Awaited<ReturnType<typeof makeBookDto>>;

export const makeBookDto = async (
  book: Book & {
    primaryNameTranslations: BookPrimaryName[];
    otherNameTranslations: BookOtherNames[];
  } & { genres: { id: string }[] },
  locale: PathLocale,
) => {
  const author = (await getAuthorById(book.authorId, locale))!;

  return {
    id: book.id,
    slug: book.slug,
    author,
    transliteration: book.transliteration,
    versions: book.versions,
    numberOfVersions: book.versions.length,
    flags: book.flags,
    primaryName: getPrimaryLocalizedText(book.primaryNameTranslations, locale),
    otherNames: getPrimaryLocalizedText(book.otherNameTranslations, locale),
    secondaryName: getSecondaryLocalizedText(book.primaryNameTranslations, locale),
    secondaryOtherNames: getSecondaryLocalizedText(book.otherNameTranslations, locale),
    genres: book.genres.map(genre => getGenreById(genre.id, locale)!),
  };
};
