import { makeGenreDto } from '@/dto/genre.dto';
import { db } from '@/lib/db';
import { PathLocale } from '@/lib/locale';

export const getGenreById = (id: string, locale: PathLocale = 'en') => {
  const genre = genreIdToGenre?.[id];
  if (!genre) return null;

  return makeGenreDto(genre, locale);
};

const get = () =>
  db.genre.findMany({
    include: {
      nameTranslations: true,
    },
  });

type RawGenre = Awaited<ReturnType<typeof get>>[number];

let genreIdToGenre: Record<string, RawGenre> | null = null;
export const populateGenres = async () => {
  if (genreIdToGenre) return;

  const genres = await get();
  genreIdToGenre = genres.reduce((acc, genre) => {
    acc[genre.id] = genre;
    return acc;
  }, {} as Record<string, RawGenre>);
};
