import { Queue } from 'bullmq';

import { createRedis } from '@/lib/redis';

export const KEYWORD_INDEXER_QUEUE_NAME = 'keyword_indexer_queue';
export const KEYWORD_INDEXER_QUEUE_REDIS = createRedis();

export type KeywordIndexerQueueData = {
  id: string;
  versionId: string;
};

export const keywordIndexerQueue = new Queue<KeywordIndexerQueueData>(
  KEYWORD_INDEXER_QUEUE_NAME,
  {
    connection: KEYWORD_INDEXER_QUEUE_REDIS,
  },
);
