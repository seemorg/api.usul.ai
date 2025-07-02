import { env } from '@/env';
import { KeywordSearchBookChunk, VectorSearchBookChunk } from '@/types/search';
import { AzureKeyCredential, SearchClient } from '@azure/search-documents';

export const keywordSearchClient = new SearchClient<KeywordSearchBookChunk>(
  env.AZURE_SEARCH_ENDPOINT,
  env.AZURE_KEYWORD_SEARCH_INDEX,
  new AzureKeyCredential(env.AZURE_SEARCH_KEY),
);

export const vectorSearchClient = new SearchClient<VectorSearchBookChunk>(
  env.AZURE_SEARCH_ENDPOINT,
  env.AZURE_VECTOR_SEARCH_INDEX,
  new AzureKeyCredential(env.AZURE_SEARCH_KEY),
);
