import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  isServer: true,
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3000),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
