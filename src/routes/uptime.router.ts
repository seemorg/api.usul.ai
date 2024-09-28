import { Hono } from 'hono';

import { getUptime } from '../lib/uptime';

const uptimeRoutes = new Hono();

uptimeRoutes.get('/uptime', async c => {
  const time = getUptime();
  return c.json({ uptime: time });
});

uptimeRoutes.get('/status', async c => {
  return c.json({ status: 'ok' });
});

export default uptimeRoutes;
