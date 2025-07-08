import { makeRegionDto, RegionDto } from '@/dto/region.dto';
import { db } from '@/lib/db';
import { PathLocale } from '@/lib/locale';
import { env } from '@/env';
import fs from 'fs';
import path from 'path';
import { getAllBooks } from './book';

export const getRegionById = (
  id: string,
  locale: PathLocale = 'en',
  params: { includeLocations?: boolean } = {},
): RegionDto | null => {
  const region = regionIdToRegion?.[id];
  if (!region) return null;

  return makeRegionDto(region, locale, params);
};

export const getRegionBySlug = (
  slug: string,
  locale: PathLocale = 'en',
  params: { includeLocations?: boolean } = {},
): RegionDto | null => {
  const region = regionSlugToRegion?.[slug];

  if (!region) return null;

  return makeRegionDto(region, locale, params);
};

export const getAllRegions = (
  locale: PathLocale = 'en',
  params?: {
    yearRange?: [number, number];
    genreId?: string;
  },
): RegionDto[] => {
  let regions = Object.values(regionIdToRegion ?? {});
  if (params && (params.yearRange || params.genreId)) {
    const books = getAllBooks(locale, params, { includeLocations: true });

    const regionIdsToCount: Record<string, number> = {};
    const regionIdsToAuthorIds: Record<string, Set<string>> = {};

    for (const book of books) {
      const regionIds = book.author.locations?.map(location => location?.regionId) ?? [];

      for (const regionId of regionIds) {
        if (!regionId) continue;
        regionIdsToCount[regionId] = (regionIdsToCount[regionId] ?? 0) + 1;
        regionIdsToAuthorIds[regionId] = (
          regionIdsToAuthorIds[regionId] ?? new Set()
        ).add(book.author.id);
      }
    }

    regions = regions
      .filter(region => regionIdsToCount[region.id] !== undefined)
      .map(region => ({
        ...region,
        numberOfBooks: regionIdsToCount[region.id] ?? 0,
        numberOfAuthors: regionIdsToAuthorIds[region.id]?.size ?? 0,
      }));
  }

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
