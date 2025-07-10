import { PathLocale } from '@/lib/locale';
import { getPrimaryLocalizedText, getSecondaryLocalizedText } from '@/lib/localization';
import { Author, AuthorBio, AuthorOtherNames, AuthorPrimaryName } from '@prisma/client';
import { getLocationById } from '@/services/location';

export type AuthorDto = ReturnType<typeof makeAuthorDto>;

export const makeAuthorDto = (
  author: Author & {
    primaryNameTranslations: AuthorPrimaryName[];
    otherNameTranslations: AuthorOtherNames[];
    bioTranslations: AuthorBio[];
    locations: { id: string }[];
  },
  locale: PathLocale,
  {
    includeLocations = false,
  }: {
    includeLocations?: boolean;
  } = {},
) => {
  return {
    id: author.id,
    slug: author.slug,
    transliteration: author.transliteration,
    year: author.year,
    numberOfBooks: author.numberOfBooks,
    primaryName: getPrimaryLocalizedText(author.primaryNameTranslations, locale),
    otherNames: getPrimaryLocalizedText(author.otherNameTranslations, locale) ?? [],

    secondaryName: getSecondaryLocalizedText(author.primaryNameTranslations, locale),
    secondaryOtherNames:
      getSecondaryLocalizedText(author.otherNameTranslations, locale) ?? [],

    bio: getPrimaryLocalizedText(author.bioTranslations, locale),

    ...(includeLocations && {
      locations: author.locations.map(location =>
        getLocationById(location.id, locale, { includeRegion: true }),
      ),
    }),
  };
};
