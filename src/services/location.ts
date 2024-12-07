import { makeLocationDto } from '@/dto/location.dto';
import { db } from '@/lib/db';
import { PathLocale } from '@/lib/locale';

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
  const locations = await get();
  if (!locationIdToLocation) locationIdToLocation = {};
  if (!regionIdToLocations) regionIdToLocations = {};

  for (const location of locations) {
    locationIdToLocation[location.id] = location;

    if (location.regionId) {
      if (!regionIdToLocations[location.regionId])
        regionIdToLocations[location.regionId] = [];
      regionIdToLocations[location.regionId].push(location);
    }
  }
};
