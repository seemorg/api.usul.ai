import { Hono } from 'hono';

import bookRoutes from './book';
import uptimeRoutes from './uptime.router';
import authorRoutes from './author';
import regionRoutes from './region';
import genreRoutes from './genre';
// import bullmqUIRoutes from './bullmq-ui.router';
import { bearerAuth } from 'hono/bearer-auth';
import { env } from '@/env';
import { populateAlternateSlugs } from '@/services/alternate-slugs';
import { populateGenres } from '@/services/genre';
import { getAuthorCount, populateAuthors } from '@/services/author';
import { populateRegions } from '@/services/region';
import { populateLocations } from '@/services/location';
import { getBookCount, populateBooks } from '@/services/book';
import { getGenreCount } from '@/services/genre';
import { getRegionCount } from '@/services/region';

const routes = new Hono();

routes.route('/', uptimeRoutes);
routes.route('/', bookRoutes);
routes.route('/', authorRoutes);
routes.route('/', regionRoutes);
routes.route('/', genreRoutes);

routes.get('/total', async c => {
  const [bookCount, authorCount, regionCount, genreCount] = await Promise.all([
    getBookCount(),
    getAuthorCount(),
    getRegionCount(),
    getGenreCount(),
  ]);

  return c.json({
    books: bookCount,
    authors: authorCount,
    regions: regionCount,
    genres: genreCount,
  });
});
// routes.route('/', bullmqUIRoutes);

routes.post('/reset-cache', bearerAuth({ token: env.DASHBOARD_PASSWORD }), async c => {
  await populateAlternateSlugs();
  await populateLocations();
  await populateRegions();
  await populateGenres();
  await populateAuthors();
  await populateBooks();

  return c.json({ message: 'Cache reset done' });
});

export default routes;
