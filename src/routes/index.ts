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
import searchRoutes from './search';
import collectionsRoutes from './collections';
import chatRoutes from './chat';
import v1Routes from './v1';

const routes = new Hono();

routes.route('/', uptimeRoutes);
routes.route('/book', bookRoutes);
routes.route('/region', regionRoutes);
routes.route('/genre', genreRoutes);
routes.route('/author', authorRoutes);
routes.route('/search', searchRoutes);

routes.route('/collections', collectionsRoutes);
routes.route('/chat', chatRoutes);
routes.route('/v1', v1Routes);

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

  return c.json({ status: 'success' });
});

routes.post(
  '/reset-cache/slugs',
  bearerAuth({ token: env.DASHBOARD_PASSWORD }),
  async c => {
    await populateAlternateSlugs();

    return c.json({ status: 'success' });
  },
);

export default routes;
