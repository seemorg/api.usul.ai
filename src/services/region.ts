import { makeRegionDto, RegionDto } from '@/dto/region.dto';
import { db } from '@/lib/db';
import { PathLocale } from '@/lib/locale';
import { getLocationsByRegionId } from './location';

export const getRegionById = (
  id: string,
  { includeLocations }: { includeLocations?: boolean } = {},
  locale: PathLocale = 'en',
) => {
  const region = regionIdToRegion?.[id];
  if (!region) return null;

  const result = makeRegionDto(region, locale) as RegionDto;
  if (includeLocations) {
    result.locations = getLocationsByRegionId(region.id, locale);
  }

  return result;
};

export const getRegionBySlug = (
  slug: string,
  { includeLocations }: { includeLocations?: boolean } = {},
  locale: PathLocale = 'en',
) => {
  const region = regionSlugToRegion?.[slug];

  if (!region) return null;

  const result = makeRegionDto(region, locale) as RegionDto;
  if (includeLocations) {
    result.locations = getLocationsByRegionId(region.id, locale);
  }

  return result;
};

export const getAllRegions = (locale: PathLocale = 'en') => {
  const regions = Object.values(regionIdToRegion ?? {});
  return regions.map(region => makeRegionDto(region, locale));
};

const get = () =>
  db.region.findMany({
    include: {
      nameTranslations: true,
      currentNameTranslations: true,
      overviewTranslations: true,
    },
  });

type RawRegion = Awaited<ReturnType<typeof get>>[number];

let regionIdToRegion: Record<string, RawRegion> | null = null;
let regionSlugToRegion: Record<string, RawRegion> | null = null;
export const populateRegions = async () => {
  const regions = await get();

  regionIdToRegion = {};
  regionSlugToRegion = {};

  for (const region of regions) {
    regionIdToRegion[region.id] = region;
    regionSlugToRegion[region.slug] = region;
  }
};
