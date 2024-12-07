import { Hono } from 'hono';

import bookRoutes from './book';
import uptimeRoutes from './uptime.router';
import authorRoutes from './author';
import regionRoutes from './region';
import genreRoutes from './genre';
// import bullmqUIRoutes from './bullmq-ui.router';

const routes = new Hono();

routes.route('/', uptimeRoutes);
routes.route('/', bookRoutes);
routes.route('/', authorRoutes);
routes.route('/', regionRoutes);
routes.route('/', genreRoutes);
// routes.route('/', bullmqUIRoutes);

export default routes;
