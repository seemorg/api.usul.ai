import { Hono } from 'hono';
import bookSearchRoutes from './books';
import globalSearchRoutes from './global';
import authorSearchRoutes from './authors';
import genresSearchRoutes from './genres';
import regionsSearchRoutes from './regions';

const searchRoutes = new Hono().basePath('/search');

searchRoutes.route('/', bookSearchRoutes);
searchRoutes.route('/', authorSearchRoutes);
searchRoutes.route('/', genresSearchRoutes);
searchRoutes.route('/', regionsSearchRoutes);
searchRoutes.route('/', globalSearchRoutes);

export default searchRoutes;
