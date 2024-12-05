import { makeRegionDto, RegionDto } from '@/dto/region.dto';
import { db } from '@/lib/db';
import { PathLocale } from '@/lib/locale';
import { getLocationsByRegionId } from './location';

export const getRegionById = async (
  id: string,
  { includeLocations }: { includeLocations?: boolean } = {},
  locale: PathLocale = 'en',
) => {
  const region = regionIdToRegion
    ? regionIdToRegion[id]
    : await db.region.findUnique({
        where: { id },
        include: {
          nameTranslations: true,
          currentNameTranslations: true,
          overviewTranslations: true,
        },
      });
  if (!region) return null;

  const result = makeRegionDto(region, locale) as RegionDto;
  if (includeLocations) {
    result.locations = await getLocationsByRegionId(region.id, locale);
  }

  return result;
};

export const getRegionBySlug = async (
  slug: string,
  { includeLocations }: { includeLocations?: boolean } = {},
  locale: PathLocale = 'en',
) => {
  const region = regionSlugToRegion
    ? regionSlugToRegion[slug]
    : await db.region.findUnique({
        where: { slug },
        include: {
          nameTranslations: true,
          currentNameTranslations: true,
          overviewTranslations: true,
        },
      });

  if (!region) return null;

  const result = makeRegionDto(region, locale) as RegionDto;
  if (includeLocations) {
    result.locations = await getLocationsByRegionId(region.id, locale);
  }

  return result;
};

export const getAllRegions = async (locale: PathLocale = 'en') => {
  const regions = regionIdToRegion ? Object.values(regionIdToRegion) : await get();
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
  if (regionIdToRegion && regionSlugToRegion) return;

  const regions = await get();
  regionIdToRegion = regions.reduce((acc, region) => {
    acc[region.id] = region;
    return acc;
  }, {} as Record<string, RawRegion>);

  regionSlugToRegion = regions.reduce((acc, region) => {
    acc[region.slug] = region;
    return acc;
  }, {} as Record<string, RawRegion>);
};
