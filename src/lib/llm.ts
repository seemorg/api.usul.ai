import { env } from '@/env';
import { createAzure } from '@ai-sdk/azure';

const azure = createAzure({
  baseURL: env.AZURE_ENDPOINT_URL,
  apiKey: env.AZURE_SECRET_KEY,
  apiVersion: '2025-01-01-preview',
});

export const model = azure.languageModel(env.AZURE_4_1_DEPLOYMENT);
