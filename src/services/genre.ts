import { makeGenreDto } from '@/dto/genre.dto';
import { env } from '@/env';
import { db } from '@/lib/db';
import { PathLocale } from '@/lib/locale';
import fs from 'fs';
import path from 'path';
import { getAllBooks } from './book';

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

export const getAllGenres = (
  locale: PathLocale = 'en',
  params?: {
    authorId?: string;
    bookIds?: string[];
    yearRange?: [number, number];
    regionId?: string;
  },
) => {
  let genres = Object.values(genreIdToGenre ?? {});
  if (
    params &&
    (params.authorId || params.bookIds || params.yearRange || params.regionId)
  ) {
    const books = getAllBooks(locale, params);
    const genreIdsToCount: Record<string, number> = {};
    for (const book of books) {
      for (const genre of book.genres) {
        genreIdsToCount[genre.id] = (genreIdsToCount[genre.id] ?? 0) + 1;
      }
    }

    genres = genres
      .filter(genre => genreIdsToCount[genre.id] !== undefined)
      .map(genre => ({
        ...genre,
        numberOfBooks: genreIdsToCount[genre.id]!,
      }))
      .sort((a, b) => b.numberOfBooks - a.numberOfBooks);
  }

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
