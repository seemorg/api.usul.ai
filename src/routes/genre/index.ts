import { localeQueryValidator } from '@/validators/locale';
import { getAllGenres, getGenreBySlug } from '@/services/genre';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const genreRoutes = new Hono().basePath('/genre');

genreRoutes.get('/', localeQueryValidator, c => {
  const { locale } = c.req.valid('query');
  const genres = getAllGenres(locale);

  return c.json(genres);
});

genreRoutes.get('/count', c => {
  const genres = getAllGenres();
  return c.json({ total: genres.length });
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
