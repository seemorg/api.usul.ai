import { Hono } from 'hono';

import bookRoutes from './book.router';
import uptimeRoutes from './uptime.router';

const routes = new Hono();

routes.route('/', uptimeRoutes);
routes.route('/book', bookRoutes);

export default routes;
