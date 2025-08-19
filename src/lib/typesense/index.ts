import { env } from '@/env';
import { Client } from 'typesense';

export const typesense = new Client({
  nodes: [
    {
      url: env.TYPESENSE_URL,
    },
  ],
  apiKey: env.TYPESENSE_API_KEY,
});
