import { PathLocale } from '@/lib/locale';
import { getPrimaryLocalizedText, getSecondaryLocalizedText } from '@/lib/localization';
import { getAuthorById } from '@/services/author';
import { getGenreById } from '@/services/genre';
import { Book, BookOtherNames, BookPrimaryName } from '@prisma/client';

export type BookDto = Awaited<ReturnType<typeof makeBookDto>>;

export const makeBookDto = (
  book: Book & {
    primaryNameTranslations: BookPrimaryName[];
    otherNameTranslations: BookOtherNames[];
  } & { genres: { id: string }[] },
  locale: PathLocale,
) => {
  const author = getAuthorById(book.authorId, locale)!;

  return {
    id: book.id,
    slug: book.slug,
    author,
    transliteration: book.transliteration,
    versions: book.versions,
    numberOfVersions: book.versions.length,
    primaryName: getPrimaryLocalizedText(book.primaryNameTranslations, locale),
    otherNames: getPrimaryLocalizedText(book.otherNameTranslations, locale),
    secondaryName: getSecondaryLocalizedText(book.primaryNameTranslations, locale),
    secondaryOtherNames: getSecondaryLocalizedText(book.otherNameTranslations, locale),
    genres: book.genres.map(genre => getGenreById(genre.id, locale)!),
    aiSupported: book.versions.some(version => version.aiSupported),
    aiVersion: book.versions.find(version => version.aiSupported)?.id ?? null,
    keywordSupported: book.versions.some(version => version.keywordSupported),
    keywordVersion: book.versions.find(version => version.keywordSupported)?.id ?? null,
  };
};
