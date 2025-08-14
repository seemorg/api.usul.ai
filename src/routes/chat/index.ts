import { Hono } from 'hono';
import singleChatRoutes from './single';
import multiChatRoutes from './multi';
import feedbackRoutes from './feedback';
import translateRoutes from './translate';

const chatRoutes = new Hono();

chatRoutes.route('/', singleChatRoutes);
chatRoutes.route('/', multiChatRoutes);
chatRoutes.route('/', feedbackRoutes);
chatRoutes.route('/', translateRoutes);

export default chatRoutes;
