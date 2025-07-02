import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  isServer: true,
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().optional(),

    REDIS_URL: z.string().url(),

    DASHBOARD_USERNAME: z.string(),
    DASHBOARD_PASSWORD: z.string(),

    R2_ENDPOINT: z.string(),
    R2_ACCESS_KEY_ID: z.string(),
    R2_SECRET_KEY: z.string(),
    R2_BUCKET: z.string(),

    TYPESENSE_URL: z.string(),
    TYPESENSE_API_KEY: z.string(),

    BETTER_AUTH_SECRET: z.string(),
    BETTER_AUTH_URL: z.string().url(),

    GOOGLE_CLIENT_ID: z.string(),
    GOOGLE_CLIENT_SECRET: z.string(),

    RESEND_API_KEY: z.string(),

    AZURE_ENDPOINT_URL: z.string().url(),
    AZURE_SECRET_KEY: z.string(),
    AZURE_4_1_DEPLOYMENT: z.string(),

    AZURE_SEARCH_ENDPOINT: z.string().url(),
    AZURE_SEARCH_KEY: z.string(),
    AZURE_VECTOR_SEARCH_INDEX: z.string(),
    AZURE_KEYWORD_SEARCH_INDEX: z.string(),

    LANGFUSE_SECRET_KEY: z.string(),
    LANGFUSE_PUBLIC_KEY: z.string(),

    COHERE_API_KEY: z.string(),
    ANSARI_API_KEY: z.string(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
