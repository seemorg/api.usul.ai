import { makeLocationDto } from '@/dto/location.dto';
import { db } from '@/lib/db';
import { PathLocale } from '@/lib/locale';
import { env } from '@/env';
import fs from 'fs';
import path from 'path';

export const getLocationById = (id: string, locale: PathLocale = 'en') => {
  const location = locationIdToLocation?.[id];
  if (!location) return null;

  return makeLocationDto(location, locale);
};

export const getLocationsByRegionId = (regionId: string, locale: PathLocale = 'en') => {
  const locations = regionIdToLocations?.[regionId] ?? [];
  return locations.map(location => makeLocationDto(location, locale));
};

const get = () =>
  db.location.findMany({
    include: {
      cityNameTranslations: true,
    },
  });

type RawLocation = Awaited<ReturnType<typeof get>>[number];

let locationIdToLocation: Record<string, RawLocation> | null = null;
let regionIdToLocations: Record<string, RawLocation[]> | null = null;
export const populateLocations = async () => {
  let locations: Awaited<ReturnType<typeof get>> | undefined;
  const filePath = path.resolve('.cache/locations.json');
  if (env.NODE_ENV === 'development') {
    // load from local
    if (fs.existsSync(filePath)) {
      locations = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  }

  if (!locations) {
    locations = await get();
    if (env.NODE_ENV === 'development') {
      // write to cache
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(locations), 'utf-8');
    }
  }

  locationIdToLocation = {};
  regionIdToLocations = {};

  for (const location of locations) {
    locationIdToLocation[location.id] = location;

    if (location.regionId) {
      if (!regionIdToLocations[location.regionId])
        regionIdToLocations[location.regionId] = [];
      regionIdToLocations[location.regionId].push(location);
    }
  }
};
