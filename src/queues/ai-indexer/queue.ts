import { Queue } from 'bullmq';

import { createRedis } from '@/lib/redis';

export const BOOKS_QUEUE_NAME = 'ai_indexer_queue';
export const BOOKS_QUEUE_REDIS = createRedis();

export type BookQueueData = {
  id: string;
  versionId: string;
};

export const booksQueue = new Queue<BookQueueData>(BOOKS_QUEUE_NAME, {
  connection: BOOKS_QUEUE_REDIS,
});
