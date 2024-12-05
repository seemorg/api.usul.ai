import { PathLocale } from '@/lib/locale';
import { getPrimaryLocalizedText, getSecondaryLocalizedText } from '@/lib/localization';
import { Region, RegionName, RegionCurrentName, RegionOverview } from '@prisma/client';
import { LocationDto } from './location.dto';

export type RegionDto = ReturnType<typeof makeRegionDto> & {
  locations?: LocationDto[];
};

export const makeRegionDto = (
  region: Region & {
    nameTranslations: RegionName[];
    currentNameTranslations: RegionCurrentName[];
    overviewTranslations: RegionOverview[];
  },
  locale: PathLocale,
) => {
  return {
    id: region.id,
    slug: region.slug,
    transliteration: region.transliteration,

    name: getPrimaryLocalizedText(region.nameTranslations, locale),
    secondaryName: getSecondaryLocalizedText(region.nameTranslations, locale),

    currentName: getPrimaryLocalizedText(region.currentNameTranslations, locale),
    secondaryCurrentName: getSecondaryLocalizedText(
      region.currentNameTranslations,
      locale,
    ),

    overview: getPrimaryLocalizedText(region.overviewTranslations, locale),
    numberOfAuthors: region.numberOfAuthors,
    numberOfBooks: region.numberOfBooks,
  };
};
