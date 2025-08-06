import { PathLocale } from '@/lib/locale';
import { getPrimaryLocalizedText, getSecondaryLocalizedText } from '@/lib/localization';
import { getRegionById } from '@/services/region';
import { Location, LocationCityName } from '@prisma/client';

export const makeLocationDto = (
  location: Location & {
    cityNameTranslations: LocationCityName[];
  },
  locale: PathLocale,
  { includeRegion = false }: { includeRegion?: boolean } = {},
): {
  id: string;
  slug: string;
  name: string | undefined;
  secondaryName: string | undefined;
  type: string;
  regionId: string | null;
  region?: any;
} => {
  const name = getPrimaryLocalizedText(location.cityNameTranslations, locale);

  return {
    id: location.id,
    slug: location.slug,
    name: locale === 'en' && location.transliteration ? location.transliteration : name,
    secondaryName: getSecondaryLocalizedText(location.cityNameTranslations, locale),
    type: location.type,
    regionId: location.regionId,
    ...(includeRegion &&
      location.regionId && {
        region: getRegionById(location.regionId, locale, {
          includeLocations: false,
        }),
      }),
  };
};

export type LocationDto = ReturnType<typeof makeLocationDto>;
