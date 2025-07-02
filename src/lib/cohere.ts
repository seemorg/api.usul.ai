import type { AzureSearchResult } from '@/book-search/search';
import { env } from '@/env';
import { CohereClient } from 'cohere-ai';

const cohere = new CohereClient({
  token: env.COHERE_API_KEY,
});

export const rerankChunks = async (
  query: string,
  chunks: AzureSearchResult[],
  options?: { topK?: number },
) => {
  const response = await cohere.rerank({
    documents: chunks.map(chunk => chunk.node.text),
    query,
    topN: options?.topK,
  });

  return response.results.map(result => chunks[result.index]!);
};
