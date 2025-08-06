import { removeDiacritics } from '@/lib/diacritics';
import { PathLocale } from '@/lib/locale';
import { getPrimaryLocalizedText, getSecondaryLocalizedText } from '@/lib/localization';
import { TypesenseAuthorDocument } from '@/types/typesense/author';
import { TypesenseBookDocument } from '@/types/typesense/book';
import { TypesenseGenreDocument } from '@/types/typesense/genre';
import { TypesenseGlobalSearchDocument } from '@/types/typesense/global-search-document';
import { TypesenseRegionDocument } from '@/types/typesense/region';
import { localeSchema } from '@/validators/locale';
import { DocumentSchema, SearchResponse } from 'typesense/lib/Typesense/Documents';
import { z } from 'zod';

export const commonSearchSchema = z.object({
  q: z.string().optional().default(''),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  page: z.coerce.number().min(1).optional().default(1),
  locale: localeSchema,
});

export const prepareQuery = (q: string) => {
  const prepared = removeDiacritics(q)
    .replace(/(al-)/gi, '')
    .replace(/(al )/gi, '')
    .replace(/(ال)/gi, '')
    .replace(/-/gi, ' ')
    .replace(/[‏.»,!?;:"'،؛؟\-_(){}\[\]<>@#\$%\^&\*\+=/\\`~]/gi, '');

  return prepared;
};

export const weightsMapToQueryWeights = (
  weightsMap: Record<number, string[]>,
): number[] =>
  Object.keys(weightsMap)
    // @ts-expect-error - TS doesn't like the fact that we're using Object.keys
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    .map(weight => new Array(weightsMap[weight]!.length).fill(weight))
    .flat();

export const formatResults = <T extends DocumentSchema>(
  results: SearchResponse<T>,
  type?: TypesenseGlobalSearchDocument['type'],
  mapFunction?: (document: T) => any,
) => {
  return {
    found: results.found,
    page: results.page,
    hits:
      results.hits?.map(h => {
        const doc = type ? { type, ...h.document } : h.document;
        return mapFunction ? mapFunction(doc) : doc;
      }) ?? [],
  };
};

export const formatPagination = (
  totalRecords: number,
  currentPage: number,
  perPage: number,
) => {
  const totalPages = Math.ceil(totalRecords / perPage);

  return {
    totalRecords,
    totalPages,
    currentPage,
    hasPrev: currentPage > 1,
    hasNext: currentPage < totalPages,
  };
};

export const formatAuthor = (author: TypesenseAuthorDocument, locale: PathLocale) => {
  const primaryName = getPrimaryLocalizedText(author.primaryNames, locale);
  const otherNames = getPrimaryLocalizedText(author.otherNames, locale);

  return {
    ...author,
    transliteration: undefined,
    otherNameTransliterations: undefined,
    _nameVariations: undefined,
    _popularity: undefined,

    primaryNames: undefined,
    primaryName:
      locale === 'en' && author.transliteration ? author.transliteration : primaryName,
    secondaryName: getSecondaryLocalizedText(author.primaryNames, locale),

    otherNames:
      locale === 'en' && author.otherNameTransliterations.length > 0
        ? author.otherNameTransliterations
        : otherNames,
    secondaryOtherNames: getSecondaryLocalizedText(author.otherNames, locale),
  };
};

export const formatBook = (book: TypesenseBookDocument, locale: PathLocale) => {
  const primaryName = getPrimaryLocalizedText(book.primaryNames, locale);
  const otherNames = getPrimaryLocalizedText(book.otherNames, locale);

  return {
    ...book,
    transliteration: undefined,
    otherNameTransliterations: undefined,
    _nameVariations: undefined,
    _popularity: undefined,

    primaryNames: undefined,
    primaryName:
      locale === 'en' && book.transliteration ? book.transliteration : primaryName,
    secondaryName: getSecondaryLocalizedText(book.primaryNames, locale),

    otherNames:
      locale === 'en' && book.otherNameTransliterations.length > 0
        ? book.otherNameTransliterations
        : otherNames,
    secondaryOtherNames: getSecondaryLocalizedText(book.otherNames, locale),
    author: formatAuthor(book.author as TypesenseAuthorDocument, locale),
  };
};

export const formatGenre = (genre: TypesenseGenreDocument, locale: PathLocale) => {
  const name = getPrimaryLocalizedText(genre.nameTranslations, locale);
  return {
    ...genre,
    transliteration: undefined,
    _popularity: undefined,

    nameTranslations: undefined,
    primaryName: locale === 'en' && genre.transliteration ? genre.transliteration : name,
    secondaryName: getSecondaryLocalizedText(genre.nameTranslations, locale),
  };
};

export const formatRegion = (region: TypesenseRegionDocument, locale: PathLocale) => {
  const name = getPrimaryLocalizedText(region.names, locale);
  const currentName = getPrimaryLocalizedText(region.currentNames, locale);

  const subLocations = region.subLocations.filter(
    subLocation => subLocation.locale === locale,
  );

  return {
    ...region,
    names: undefined,
    transliteration: undefined,
    _popularity: undefined,

    primaryName:
      locale === 'en' && region.transliteration ? region.transliteration : name,
    secondaryName: getSecondaryLocalizedText(region.names, locale),

    currentNames: undefined,
    currentName:
      locale === 'en' && region.currentNameTransliteration
        ? region.currentNameTransliteration
        : currentName,

    subLocations: (subLocations.length === 0 && locale !== 'en'
      ? region.subLocations.filter(subLocation => subLocation.locale === 'en')
      : subLocations
    ).map(subLocation => subLocation.text),
  };
};

export const formatGlobalSearch = (
  globalSearch: TypesenseGlobalSearchDocument,
  locale: PathLocale,
) => {
  const primaryName = getPrimaryLocalizedText(globalSearch.primaryNames, locale);
  return {
    ...globalSearch,
    transliteration: undefined,
    _nameVariations: undefined,
    _popularity: undefined,
    _rank: undefined,

    primaryNames: undefined,
    primaryName:
      locale === 'en' && globalSearch.transliteration
        ? globalSearch.transliteration
        : primaryName,
    secondaryName: getSecondaryLocalizedText(globalSearch.primaryNames, locale),

    otherNames: getPrimaryLocalizedText(globalSearch.otherNames, locale),

    author: globalSearch.author
      ? formatAuthor(globalSearch.author as TypesenseAuthorDocument, locale)
      : undefined,
  };
};
