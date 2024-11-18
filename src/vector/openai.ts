import { env } from '@/env';
import { AzureOpenAI } from 'openai';

export const embeddings = new AzureOpenAI({
  apiKey: env.AZURE_OPENAI_KEY,
  endpoint: `https://${env.AZURE_OPENAI_RESOURCE_NAME}.openai.azure.com`,
  deployment: env.AZURE_EMBEDDINGS_DEPLOYMENT_NAME,
  apiVersion: '2024-10-21',
}).embeddings;
