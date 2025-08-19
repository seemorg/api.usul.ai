import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import {
  commonSearchSchema,
  formatGenre,
  formatPagination,
  formatResults,
  prepareQuery,
  weightsMapToQueryWeights,
} from './utils';
import { z } from 'zod';
import { typesense } from '@/lib/typesense';
import { TypesenseGenreDocument } from '@/types/typesense/genre';
import { GENRES_COLLECTION, genresQueryWeights } from '@/lib/typesense/collections';

const genresSearchRoutes = new Hono();

genresSearchRoutes.get(
  '/genres',
  zValidator(
    'query',
    commonSearchSchema.extend({
      sortBy: z.enum(['relevance', 'texts-asc', 'texts-desc']).optional(),
    }),
  ),
  async c => {
    const { q, limit, page, sortBy, locale } = c.req.valid('query');

    const results = await typesense
      .collections<TypesenseGenreDocument>(GENRES_COLLECTION.INDEX)
      .documents()
      .search({
        q: prepareQuery(q),
        query_by: Object.values(genresQueryWeights).flat(),
        query_by_weights: weightsMapToQueryWeights(genresQueryWeights),
        prioritize_token_position: true,
        limit,
        page,
        ...(sortBy &&
          sortBy !== 'relevance' && {
            sort_by: {
              'texts-asc': 'booksCount:asc',
              'texts-desc': 'booksCount:desc',
            }[sortBy],
          }),
      });

    return c.json({
      results: formatResults(results, 'genre', genre => formatGenre(genre, locale)),
      pagination: formatPagination(results.found, results.page, limit),
    });
  },
);

export default genresSearchRoutes;
