import { Hono } from 'hono';
import bookSearchRoutes from './books';
import globalSearchRoutes from './global';
import authorSearchRoutes from './authors';
import genresSearchRoutes from './genres';
import regionsSearchRoutes from './regions';
import allSearchRoutes from './all';
import contentSearchRoutes from './content';

const searchRoutes = new Hono();

searchRoutes.route('/', allSearchRoutes);
searchRoutes.route('/', bookSearchRoutes);
searchRoutes.route('/', authorSearchRoutes);
searchRoutes.route('/', genresSearchRoutes);
searchRoutes.route('/', regionsSearchRoutes);
searchRoutes.route('/', globalSearchRoutes);
searchRoutes.route('/', contentSearchRoutes);

export default searchRoutes;
