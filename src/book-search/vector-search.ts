import { env } from '@/env';
import { AzureKeyCredential, SearchClient } from '@azure/search-documents';

export type VectorSearchBookChunk = {
  id: string;
  book_id: string;
  book_version_id: string;
  prev_id?: string | null;
  next_id?: string | null;
  chunk_content: string;
  chunk_embedding: number[];
  chapters: number[]; // chapter indices
  pages: {
    index: number;
    page: number;
    volume?: string | null;
  }[];
};

export const vectorSearchClient = new SearchClient<VectorSearchBookChunk>(
  env.AZURE_SEARCH_ENDPOINT,
  env.AZURE_VECTOR_SEARCH_INDEX,
  new AzureKeyCredential(env.AZURE_SEARCH_KEY),
);
