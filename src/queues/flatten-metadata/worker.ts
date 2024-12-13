import { Worker } from 'bullmq';

import type { FlattenMetadataQueueData } from './queue';
import { FLATTEN_METADATA_QUEUE_NAME, FLATTEN_METADATA_QUEUE_REDIS } from './queue';

import path from 'path';

export const worker = new Worker<FlattenMetadataQueueData>(
  FLATTEN_METADATA_QUEUE_NAME,
  path.resolve('dist/workers/metadata.worker.js'),
  {
    connection: FLATTEN_METADATA_QUEUE_REDIS,
    concurrency: 5,
  },
);
