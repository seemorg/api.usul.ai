import { getAuthorByAlternateSlug } from '@/services/alternate-slugs';
import { getAuthorById, getAuthorBySlug, getAuthorCount } from '@/services/author';
import { localeSchema } from '@/validators/locale';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const authorRoutes = new Hono();

authorRoutes.get('/count', async c => {
  const count = await getAuthorCount();
  return c.json({ total: count });
});

authorRoutes.get(
  '/:slug',
  zValidator('param', z.object({ slug: z.string() })),
  zValidator(
    'query',
    z.object({
      locale: localeSchema,
    }),
  ),
  async c => {
    const { slug } = c.req.valid('param');
    const { locale } = c.req.valid('query');

    const author = await getAuthorBySlug(slug, locale);
    if (!author) {
      const alternateSlugAuthorId = getAuthorByAlternateSlug(slug);
      if (alternateSlugAuthorId) {
        const primarySlug = (await getAuthorById(alternateSlugAuthorId, locale))?.slug;
        if (primarySlug) {
          return c.json({ type: 'alternate-slug', primarySlug });
        }
      }

      throw new HTTPException(404, { message: 'Author not found' });
    }

    return c.json(author);
  },
);

export default authorRoutes;
