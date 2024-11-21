import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  isServer: true,
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().optional(),
    AZURE_SEARCH_ENDPOINT: z.string().url(),
    AZURE_SEARCH_KEY: z.string(),
    AZURE_SEARCH_INDEX: z.string(),
    AZURE_OPENAI_KEY: z.string(),
    AZURE_OPENAI_RESOURCE_NAME: z.string(),
    AZURE_EMBEDDINGS_DEPLOYMENT_NAME: z.string(),
    REDIS_URL: z.string().url(),
    DASHBOARD_USERNAME: z.string(),
    DASHBOARD_PASSWORD: z.string(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
