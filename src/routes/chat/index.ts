import { Hono } from 'hono';
import singleChatRoutes from './single';
import multiChatRoutes from './multi';
import feedbackRoutes from './feedback';

const chatRoutes = new Hono();

chatRoutes.route('/', singleChatRoutes);
chatRoutes.route('/', multiChatRoutes);
chatRoutes.route('/', feedbackRoutes);

export default chatRoutes;
