import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import {
  commonSearchSchema,
  formatGenre,
  formatPagination,
  formatRegion,
  formatResults,
  prepareQuery,
  weightsMapToQueryWeights,
} from './utils';
import { z } from 'zod';
import { typesense } from '@/lib/typesense';
import { TypesenseRegionDocument } from '@/types/typesense/region';
import { REGIONS_COLLECTION, regionsQueryWeights } from '@/lib/typesense/collections';

const regionsSearchRoutes = new Hono();

regionsSearchRoutes.get(
  '/regions',
  zValidator(
    'query',
    commonSearchSchema.extend({
      sortBy: z
        .enum([
          'relevance',
          'texts-asc',
          'texts-desc',
          'authors-asc',
          'authors-desc',
          'alphabetical-asc',
          'alphabetical-desc',
        ])
        .optional(),
    }),
  ),
  async c => {
    const { q, limit, page, sortBy, locale } = c.req.valid('query');

    const results = await typesense
      .collections<TypesenseRegionDocument>(REGIONS_COLLECTION.INDEX)
      .documents()
      .search({
        q: prepareQuery(q),
        query_by: Object.values(regionsQueryWeights).flat(),
        query_by_weights: weightsMapToQueryWeights(regionsQueryWeights),
        prioritize_token_position: true,
        limit,
        page,
        ...(sortBy &&
          sortBy !== 'relevance' && {
            sort_by: {
              'texts-asc': 'booksCount:asc',
              'texts-desc': 'booksCount:desc',
              'authors-asc': 'authorsCount:asc',
              'authors-desc': 'authorsCount:desc',
              'alphabetical-asc': 'transliteration:asc',
              'alphabetical-desc': 'transliteration:desc',
            }[sortBy],
          }),
      });

    return c.json({
      results: formatResults(results, 'region', region => formatRegion(region, locale)),
      pagination: formatPagination(results.found, results.page, limit),
    });
  },
);

export default regionsSearchRoutes;
