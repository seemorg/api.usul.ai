import { LocationDto, makeLocationDto } from '@/dto/location.dto';
import { env } from '@/env';
import { db } from '@/lib/db';
import { PathLocale } from '@/lib/locale';

export const getLocationById = async (id: string, locale: PathLocale = 'en') => {
  const location =
    env.NODE_ENV === 'development'
      ? await db.location.findUnique({
          where: { id },
          include: {
            cityNameTranslations: true,
          },
        })
      : locationIdToLocation?.[id];
  if (!location) return null;

  return makeLocationDto(location, locale);
};

export const getLocationsByRegionId = async (
  regionId: string,
  locale: PathLocale = 'en',
) => {
  const locations = locationIdToLocation
    ? Object.values(locationIdToLocation)
    : await get();

  const results: LocationDto[] = [];
  for (const location of locations) {
    if (location.regionId !== regionId) continue;
    results.push(makeLocationDto(location, locale));
  }

  return results;
};

const get = () =>
  db.location.findMany({
    include: {
      cityNameTranslations: true,
    },
  });

type RawLocation = Awaited<ReturnType<typeof get>>[number];

let locationIdToLocation: Record<string, RawLocation> | null = null;
export const populateLocations = async () => {
  if (locationIdToLocation) return;

  const locations = await get();
  locationIdToLocation = locations.reduce((acc, location) => {
    acc[location.id] = location;
    return acc;
  }, {} as Record<string, RawLocation>);
};
