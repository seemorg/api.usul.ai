import Redis from 'ioredis';

import { env } from '../env';

export const createRedis = () =>
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
