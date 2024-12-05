import { PathLocale } from '@/lib/locale';
import { getPrimaryLocalizedText, getSecondaryLocalizedText } from '@/lib/localization';
import { Location, LocationCityName } from '@prisma/client';

export type LocationDto = ReturnType<typeof makeLocationDto>;

export const makeLocationDto = (
  location: Location & {
    cityNameTranslations: LocationCityName[];
  },
  locale: PathLocale,
) => {
  return {
    id: location.id,
    slug: location.slug,
    transliteration: location.transliteration,
    name: getPrimaryLocalizedText(location.cityNameTranslations, locale),
    secondaryName: getSecondaryLocalizedText(location.cityNameTranslations, locale),
    type: location.type,
    regionId: location.regionId,
  };
};
