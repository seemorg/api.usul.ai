import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/dist/src/queueAdapters/bullMQ.js';
import { HonoAdapter } from '@bull-board/hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';

import { booksQueue } from '@/queues/ai-indexer/queue';
import { keywordIndexerQueue } from '@/queues/keyword-indexer/queue';
import { env } from '../env';

const basePath = '/ui';
const bullmqUIRoutes = new Hono().basePath(basePath);

bullmqUIRoutes.use(
  basicAuth({
    username: env.DASHBOARD_USERNAME,
    password: env.DASHBOARD_PASSWORD,
  }),
);

const serverAdapter = new HonoAdapter(serveStatic).setBasePath(basePath);

createBullBoard({
  queues: [new BullMQAdapter(booksQueue), new BullMQAdapter(keywordIndexerQueue)],
  serverAdapter,
});

bullmqUIRoutes.route('/', serverAdapter.registerPlugin() as any);

export default bullmqUIRoutes;
