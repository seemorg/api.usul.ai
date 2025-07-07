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
  transliteration: string | null;
  name: string | undefined;
  secondaryName: string | undefined;
  type: string;
  regionId: string | null;
  region?: any;
} => {
  return {
    id: location.id,
    slug: location.slug,
    transliteration: location.transliteration,
    name: getPrimaryLocalizedText(location.cityNameTranslations, locale),
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
