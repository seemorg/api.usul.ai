import { makeGenreDto } from '@/dto/genre.dto';
import { env } from '@/env';
import { db } from '@/lib/db';
import { PathLocale } from '@/lib/locale';
import fs from 'fs';
import path from 'path';

export const getGenreById = (id: string, locale: PathLocale = 'en') => {
  const genre = genreIdToGenre?.[id];
  if (!genre) return null;

  return makeGenreDto(genre, locale);
};

export const getGenreBySlug = (slug: string, locale: PathLocale = 'en') => {
  const genre = genreSlugToGenre?.[slug];
  if (!genre) return null;

  return makeGenreDto(genre, locale);
};

export const getAllGenres = (locale: PathLocale = 'en') => {
  const genres = Object.values(genreIdToGenre ?? {});
  return genres.map(genre => makeGenreDto(genre, locale));
};

export const getGenreCount = async () => {
  if (genreIdToGenre) {
    return Object.keys(genreIdToGenre).length;
  }

  return db.genre.count();
};

const get = () =>
  db.genre.findMany({
    include: {
      nameTranslations: true,
    },
  });

type RawGenre = Awaited<ReturnType<typeof get>>[number];

let genreIdToGenre: Record<string, RawGenre> | null = null;
let genreSlugToGenre: Record<string, RawGenre> | null = null;
export const populateGenres = async () => {
  let genres: Awaited<ReturnType<typeof get>> | undefined;
  const filePath = path.resolve('.cache/genres.json');
  if (env.NODE_ENV === 'development') {
    // load from local
    if (fs.existsSync(filePath)) {
      genres = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  }

  if (!genres) {
    genres = await get();
    if (env.NODE_ENV === 'development') {
      // write to cache
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(genres), 'utf-8');
    }
  }

  genreIdToGenre = {};
  genreSlugToGenre = {};

  for (const genre of genres) {
    genreIdToGenre[genre.id] = genre;
    genreSlugToGenre[genre.slug] = genre;
  }
};
