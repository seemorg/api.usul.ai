import path from 'path';
import { Worker } from 'bullmq';

import type { BookQueueData } from './queue';
import { BOOKS_QUEUE_NAME, BOOKS_QUEUE_REDIS } from './queue';

export const worker = new Worker<BookQueueData>(
  BOOKS_QUEUE_NAME,
  path.resolve(`dist/books-processor.js`),
  {
    connection: BOOKS_QUEUE_REDIS,
    concurrency: 5,
    lockDuration: 1000 * 60 * 40, // 40 minutes
    // stalledInterval: 1000 * 60 * 40, // 40 minutes
  },
);
