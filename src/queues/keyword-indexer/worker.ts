import path from 'path';
import { Worker } from 'bullmq';

import type { KeywordIndexerQueueData } from './queue';
import { KEYWORD_INDEXER_QUEUE_NAME, KEYWORD_INDEXER_QUEUE_REDIS } from './queue';

export const worker = new Worker<KeywordIndexerQueueData>(
  KEYWORD_INDEXER_QUEUE_NAME,
  path.resolve(`dist/keyword-indexer.js`),
  {
    connection: KEYWORD_INDEXER_QUEUE_REDIS,
    concurrency: 10,
    lockDuration: 1000 * 60 * 40, // 40 minutes
  },
);
