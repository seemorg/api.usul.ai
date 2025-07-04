import { makeRegionDto, RegionDto } from '@/dto/region.dto';
import { db } from '@/lib/db';
import { PathLocale } from '@/lib/locale';
import { getLocationsByRegionId } from './location';
import { env } from '@/env';
import fs from 'fs';
import path from 'path';

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

export const getRegionCount = async () => {
  if (regionIdToRegion) {
    return Object.keys(regionIdToRegion).length;
  }

  return db.region.count();
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
  let regions: Awaited<ReturnType<typeof get>> | undefined;
  const filePath = path.resolve('.cache/regions.json');
  if (env.NODE_ENV === 'development') {
    // load from local
    if (fs.existsSync(filePath)) {
      regions = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  }

  if (!regions) {
    regions = await get();
    if (env.NODE_ENV === 'development') {
      // write to cache
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(regions), 'utf-8');
    }
  }

  regionIdToRegion = {};
  regionSlugToRegion = {};

  for (const region of regions) {
    regionIdToRegion[region.id] = region;
    regionSlugToRegion[region.slug] = region;
  }
};
