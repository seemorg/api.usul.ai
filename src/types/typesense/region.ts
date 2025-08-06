import type { LocalizedEntry } from './localized-entry';

export type TypesenseRegionDocument = {
  id: string;
  slug: string;

  transliteration?: string;
  currentNameTransliteration?: string;
  names: LocalizedEntry[];
  currentNames: LocalizedEntry[];

  booksCount: number;
  authorsCount: number;
  _popularity: number;

  subLocations: LocalizedEntry[];
  subLocationsCount: number;
};
