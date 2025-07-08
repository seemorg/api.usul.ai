import { getAllCenturies } from '@/services/book';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

const centuryRoutes = new Hono();

centuryRoutes.get('/', c => {
  const centuries = getAllCenturies();
  return c.json(centuries);
});

centuryRoutes.get(
  '/:centuryNumber',
  zValidator('param', z.object({ centuryNumber: z.coerce.number() })),
  c => {
    const { centuryNumber } = c.req.valid('param');
    const centuries = getAllCenturies();
    const century = centuries.find(c => c.centuryNumber === centuryNumber);
    if (!century) {
      return c.json({ error: 'Century not found' }, 404);
    }

    return c.json(century);
  },
);

export default centuryRoutes;
