import { Hono } from 'hono';

import bookDetailsRoutes from './details';
import pageRoutes from './page';
import bySlugRoutes from './by-slug';
import homepageSectionsRoutes from './homepage-sections';

const bookRoutes = new Hono().basePath('/book');

bookRoutes.route('/', bookDetailsRoutes);
bookRoutes.route('/', homepageSectionsRoutes);
bookRoutes.route('/', pageRoutes);
bookRoutes.route('/', bySlugRoutes);

export default bookRoutes;
