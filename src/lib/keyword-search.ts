import { env } from '@/env';
import {
  AzureKeyCredential,
  KnownAnalyzerNames,
  SearchClient,
  SearchIndex,
  SearchIndexClient,
} from '@azure/search-documents';

export type KeywordSearchBookPage = {
  id: string;
  book_id: string;
  book_version_id: string;
  content: string;
  chapters: number[]; // chapter indices
  index: number; // page index
  page: number;
  volume?: string | null;
};

export const keywordSearchClient = new SearchClient<KeywordSearchBookPage>(
  env.AZURE_SEARCH_ENDPOINT,
  env.AZURE_KEYWORD_SEARCH_INDEX,
  new AzureKeyCredential(env.AZURE_SEARCH_KEY),
);

const client = new SearchIndexClient(
  env.AZURE_SEARCH_ENDPOINT,
  new AzureKeyCredential(env.AZURE_SEARCH_KEY),
);

const index: SearchIndex = {
  name: env.AZURE_KEYWORD_SEARCH_INDEX,
  fields: [
    { name: 'id', type: 'Edm.String', key: true },
    {
      name: 'book_id',
      type: 'Edm.String',
      filterable: true,
      facetable: true,
      searchable: false,
    },
    {
      name: 'book_version_id',
      type: 'Edm.String',
      filterable: true,
      facetable: true,
      searchable: false,
    },

    {
      name: 'content',
      type: 'Edm.String',
      searchable: true,
      analyzerName: KnownAnalyzerNames.ArLucene,
    },

    {
      name: 'chapters',
      type: 'Collection(Edm.Int32)',
      filterable: true,
      facetable: true,
    },
    {
      type: 'Edm.Int32',
      name: 'index',
      filterable: true,
    },
    {
      type: 'Edm.Int32',
      name: 'page',
      filterable: true,
    },
    {
      type: 'Edm.String',
      name: 'volume',
      searchable: false,
      filterable: true,
    },
  ],
};

export const createKeywordSearchIndexIfNotExists = async () => {
  try {
    await client.getIndex(index.name);
  } catch (error: any) {
    if (error?.code === 'ENOTFOUND' || error?.statusCode === 404) {
      console.log('Keyword search index not found, creating it now...');
      await client.createIndex(index);
      console.log('Keyword search index created successfully!');
    } else {
      console.log('An error occurred while checking the keyword search index!');
      console.log(error);
    }
  }
};
