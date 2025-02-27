import { Hono } from 'hono';

import bookDetailsRoutes from './details';
import pageRoutes from './page';
import bySlugRoutes from './by-slug';
import homepageSectionsRoutes from './homepage-sections';
import { getBookCount } from '@/services/book';

const bookRoutes = new Hono().basePath('/book');

bookRoutes.route('/', bookDetailsRoutes);
bookRoutes.route('/', homepageSectionsRoutes);
bookRoutes.route('/', pageRoutes);
bookRoutes.route('/', bySlugRoutes);

bookRoutes.get('/count', async c => {
  const count = await getBookCount();
  return c.json({ total: count });
});

export default bookRoutes;
