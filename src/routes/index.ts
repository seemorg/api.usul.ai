import { Hono } from 'hono';

import bookRoutes from './book.router';
import uptimeRoutes from './uptime.router';
import bullmqUIRoutes from './bullmq-ui.router';

const routes = new Hono();

routes.route('/', uptimeRoutes);
routes.route('/', bookRoutes);
routes.route('/', bullmqUIRoutes);

export default routes;
