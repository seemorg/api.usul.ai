import { Queue } from 'bullmq';

import { createRedis } from '@/lib/redis';

export const FLATTEN_METADATA_QUEUE_NAME = 'flatten_metadata_queue';
export const FLATTEN_METADATA_QUEUE_REDIS = createRedis();

export type FlattenMetadataQueueData = {
  bookId: string;
};

export const flattenMetadataQueue = new Queue<FlattenMetadataQueueData>(
  FLATTEN_METADATA_QUEUE_NAME,
  {
    connection: FLATTEN_METADATA_QUEUE_REDIS,
  },
);
