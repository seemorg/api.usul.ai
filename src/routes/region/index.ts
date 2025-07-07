import { localeQueryValidator } from '@/validators/locale';
import { getAllRegions, getRegionBySlug, getRegionCount } from '@/services/region';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const regionRoutes = new Hono();

regionRoutes.get('/', localeQueryValidator, c => {
  const { locale } = c.req.valid('query');
  const regions = getAllRegions(locale);

  return c.json(regions);
});

regionRoutes.get('/count', async c => {
  const count = await getRegionCount();
  return c.json({ total: count });
});

regionRoutes.get(
  '/:slug',
  zValidator('param', z.object({ slug: z.string() })),
  localeQueryValidator,
  zValidator(
    'query',
    z.object({
      locations: z.coerce.boolean().optional().default(false),
    }),
  ),
  c => {
    const { slug } = c.req.valid('param');
    const { locale, locations } = c.req.valid('query');

    const region = getRegionBySlug(slug, locale, { includeLocations: locations });
    if (!region) {
      throw new HTTPException(404, { message: 'Region not found' });
    }

    return c.json(region);
  },
);

export default regionRoutes;
