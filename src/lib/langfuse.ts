import { env } from '@/env';
import { Langfuse } from 'langfuse';

export const langfuseConfig = {
  secretKey: env.LANGFUSE_SECRET_KEY,
  publicKey: env.LANGFUSE_PUBLIC_KEY,
  baseUrl: 'https://us.cloud.langfuse.com',
};

export const langfuse = new Langfuse(langfuseConfig);
