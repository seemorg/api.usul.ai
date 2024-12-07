import { makeGenreDto } from '@/dto/genre.dto';
import { db } from '@/lib/db';
import { PathLocale } from '@/lib/locale';

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
  const genres = await get();

  if (!genreIdToGenre) genreIdToGenre = {};
  if (!genreSlugToGenre) genreSlugToGenre = {};

  for (const genre of genres) {
    genreIdToGenre[genre.id] = genre;
    genreSlugToGenre[genre.slug] = genre;
  }
};
