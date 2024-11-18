import { env } from '@/env';
import {
  AzureKeyCredential,
  KnownAnalyzerNames,
  SearchClient,
  SearchIndex,
  SearchIndexClient,
} from '@azure/search-documents';

export type BookChunk = {
  id: string;
  book_id: string;
  chunk_content: string;
  chunk_embedding: number[];
  chapters: number[]; // chapter indices
  pages: {
    index: number;
    page: number;
    volume?: string;
  }[];
};

export const searchClient = new SearchClient<BookChunk>(
  env.AZURE_SEARCH_ENDPOINT,
  env.AZURE_SEARCH_INDEX,
  new AzureKeyCredential(env.AZURE_SEARCH_KEY),
);

const client = new SearchIndexClient(
  env.AZURE_SEARCH_ENDPOINT,
  new AzureKeyCredential(env.AZURE_SEARCH_KEY),
);

const index: SearchIndex = {
  name: env.AZURE_SEARCH_INDEX,
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
      name: 'chunk_content',
      type: 'Edm.String',
      searchable: true,
      analyzerName: KnownAnalyzerNames.ArLucene,
    },
    {
      name: 'chunk_embedding',
      type: 'Collection(Edm.Single)',
      searchable: true,
      vectorSearchDimensions: 3072,
      vectorSearchProfileName: 'vector-search-profile',
      stored: false,
    },
    {
      name: 'chapters',
      type: 'Collection(Edm.Int32)',
      filterable: true,
      facetable: true,
    },
    {
      type: 'Collection(Edm.ComplexType)',
      name: 'pages',
      fields: [
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
    },
  ],
  vectorSearch: {
    algorithms: [{ name: 'vector-search-algorithm', kind: 'hnsw' }],
    vectorizers: [
      {
        vectorizerName: 'vector-search-vectorizer',
        kind: 'azureOpenAI',
        parameters: {
          resourceUrl: `https://${env.AZURE_OPENAI_RESOURCE_NAME}.openai.azure.com`,
          deploymentId: env.AZURE_EMBEDDINGS_DEPLOYMENT_NAME,
          modelName: 'text-embedding-3-large',
        },
      },
    ],
    profiles: [
      {
        name: 'vector-search-profile',
        algorithmConfigurationName: 'vector-search-algorithm',
        vectorizerName: 'vector-search-vectorizer',
      },
    ],
  },
};

export const createIndexIfNotExists = async () => {
  try {
    await client.getIndex(index.name);
  } catch (error: any) {
    if (error?.code === 'ENOTFOUND' || error?.statusCode === 404) {
      console.log('Index not found, creating it now...');
      await client.createIndex(index);
      console.log('Index created successfully!');
    } else {
      console.log('An error occurred while checking the index!');
      console.log(error);
    }
  }
};
