import { PathLocale } from '@/lib/locale';
import { getPrimaryLocalizedText, getSecondaryLocalizedText } from '@/lib/localization';
import { getLocationsByRegionId } from '@/services/location';
import { Region, RegionName, RegionCurrentName, RegionOverview } from '@prisma/client';

export const makeRegionDto = (
  region: Region & {
    nameTranslations: RegionName[];
    currentNameTranslations: RegionCurrentName[];
    overviewTranslations: RegionOverview[];
  },
  locale: PathLocale,
  { includeLocations = false }: { includeLocations?: boolean } = {},
): {
  id: string;
  slug: string;
  name: string | undefined;
  secondaryName: string | undefined;
  currentName: string | undefined;
  secondaryCurrentName: string | undefined;
  overview: string | undefined;
  numberOfAuthors: number;
  numberOfBooks: number;
  locations?: any[];
} => {
  const name = getPrimaryLocalizedText(region.nameTranslations, locale);
  const currentName = getPrimaryLocalizedText(region.currentNameTranslations, locale);

  return {
    id: region.id,
    slug: region.slug,

    name: locale === 'en' && region.transliteration ? region.transliteration : name,
    secondaryName: getSecondaryLocalizedText(region.nameTranslations, locale),

    currentName:
      locale === 'en' && region.currentNameTransliteration
        ? region.currentNameTransliteration
        : currentName,
    secondaryCurrentName: getSecondaryLocalizedText(
      region.currentNameTranslations,
      locale,
    ),

    overview: getPrimaryLocalizedText(region.overviewTranslations, locale),
    numberOfAuthors: region.numberOfAuthors,
    numberOfBooks: region.numberOfBooks,

    ...(includeLocations && {
      locations: getLocationsByRegionId(region.id, locale),
    }),
  };
};

export type RegionDto = ReturnType<typeof makeRegionDto>;
