import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import {
  commonSearchSchema,
  formatGlobalSearch,
  formatPagination,
  formatResults,
  prepareQuery,
  weightsMapToQueryWeights,
} from './utils';
import { typesense } from '@/lib/typesense';
import { TypesenseGlobalSearchDocument } from '@/types/typesense/global-search-document';

const globalSearchRoutes = new Hono();

const globalSearchQueryWeights = {
  4: ['primaryNames.text', '_nameVariations'],
  3: ['otherNames.texts'],
  2: ['author.primaryNames.text', 'author._nameVariations'],
  1: ['author.otherNames.texts'],
};

export const GLOBAL_SEARCH_COLLECTION = {
  INDEX: 'all_documents',
  DEFAULT_PER_PAGE: 20,
};

globalSearchRoutes.get('/all', zValidator('query', commonSearchSchema), async c => {
  const { q, limit, page, locale } = c.req.valid('query');

  const results = await typesense
    .collections<TypesenseGlobalSearchDocument>(GLOBAL_SEARCH_COLLECTION.INDEX)
    .documents()
    .search({
      q: prepareQuery(q),
      query_by: Object.values(globalSearchQueryWeights).flat(),
      query_by_weights: weightsMapToQueryWeights(globalSearchQueryWeights),
      prioritize_token_position: true,
      limit,
      page,
      sort_by: '_text_match(buckets: 10):desc,_rank:asc,_popularity:desc',
    });

  return c.json({
    results: formatResults(results, undefined, globalSearch =>
      formatGlobalSearch(globalSearch, locale),
    ),
    pagination: formatPagination(results.found, results.page, limit),
  });
});

export default globalSearchRoutes;
