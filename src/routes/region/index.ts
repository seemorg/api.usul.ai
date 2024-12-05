import { getAllRegions, getRegionBySlug } from '@/services/region';
import { localeSchema } from '@/validators/locale';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const regionRoutes = new Hono().basePath('/region');

regionRoutes.get(
  '/',
  zValidator(
    'query',
    z.object({
      locale: localeSchema,
    }),
  ),
  async c => {
    const { locale } = c.req.valid('query');

    const regions = await getAllRegions(locale);

    return c.json(regions);
  },
);

regionRoutes.get('/count', async c => {
  const regions = await getAllRegions();
  return c.json({ total: regions.length });
});

regionRoutes.get(
  '/:slug',
  zValidator('param', z.object({ slug: z.string() })),
  zValidator(
    'query',
    z.object({
      locale: localeSchema,
      locations: z.coerce.boolean().optional().default(false),
    }),
  ),
  async c => {
    const { slug } = c.req.valid('param');
    const { locale, locations } = c.req.valid('query');

    const region = await getRegionBySlug(slug, { includeLocations: locations }, locale);
    if (!region) {
      throw new HTTPException(404, { message: 'Region not found' });
    }

    return c.json(region);
  },
);

export default regionRoutes;
