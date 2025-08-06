import type { LocalizedArrayEntry, LocalizedEntry } from './localized-entry';

export type TypesenseAuthorDocument = {
  id: string;
  slug: string;
  year: number;
  transliteration?: string;
  primaryNames: LocalizedEntry[];
  otherNames: LocalizedArrayEntry[];
  otherNameTransliterations: string[];
  bios: LocalizedEntry[];
  _nameVariations: string[];
  _popularity: number;
  regions: string[]; // region slugs
  geographies: string[];
  booksCount: number;
};
