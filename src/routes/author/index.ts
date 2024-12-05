import { localeSchema } from '@/validators/locale';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

const authorRoutes = new Hono().basePath('/author');

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

    return c.json({ slug });
  },
);

export default authorRoutes;
