import { localeQueryValidator } from '@/validators/locale';
import {
  getAllGenres,
  getGenreById,
  getGenreBySlug,
  getGenreCount,
} from '@/services/genre';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const genreRoutes = new Hono();

const homepageGenres = [
  {
    id: 'quranic-sciences',
    color: 'gray',
    pattern: 1,
  },
  {
    id: 'hadith',
    color: 'red',
    pattern: 2,
  },
  // {
  //   id: 'fiqh',
  //   color: 'green',
  //   pattern: 3,
  // },
  {
    id: 'history',
    color: 'indigo',
    pattern: 5,
  },
  {
    id: 'ilm-al-kalam',
    color: 'yellow',
    pattern: 4,
  },
  {
    id: 'philosophy',
    color: 'green',
    pattern: 7,
  },
  {
    id: 'literature',
    color: 'gray',
    pattern: 9,
  },
];

genreRoutes.get('/homepage', localeQueryValidator, c => {
  const { locale } = c.req.valid('query');

  const genres = homepageGenres.map(genre => ({
    ...genre,
    ...(getGenreById(genre.id, locale) ?? {}),
  }));

  return c.json(genres);
});

genreRoutes.get('/', localeQueryValidator, c => {
  const { locale } = c.req.valid('query');
  const genres = getAllGenres(locale);

  return c.json(genres);
});

genreRoutes.get('/count', async c => {
  const count = await getGenreCount();
  return c.json({ total: count });
});

genreRoutes.get(
  '/:slug',
  zValidator('param', z.object({ slug: z.string() })),
  localeQueryValidator,
  c => {
    const { slug } = c.req.valid('param');
    const { locale } = c.req.valid('query');

    const genre = getGenreBySlug(slug, locale);
    if (!genre) {
      throw new HTTPException(404, { message: 'Genre not found' });
    }

    return c.json(genre);
  },
);

export default genreRoutes;
