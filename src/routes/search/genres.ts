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

const genresSearchRoutes = new Hono();

const genresQueryWeights = {
  1: ['nameTranslations.text'],
};

export const GENRES_COLLECTION = {
  INDEX: 'genres',
  DEFAULT_PER_PAGE: 5,
};

genresSearchRoutes.get(
  '/genres',
  zValidator(
    'query',
    commonSearchSchema.extend({
      sort: z.enum(['relevance', 'texts-asc', 'texts-desc']).optional(),
    }),
  ),
  async c => {
    const { q, limit, page, sort, locale } = c.req.valid('query');

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

        ...(sort &&
          sort !== 'relevance' && {
            sort_by: {
              'texts-asc': 'booksCount:asc',
              'texts-desc': 'booksCount:desc',
            }[sort],
          }),
      });

    return c.json({
      results: formatResults(results, 'genre', genre => formatGenre(genre, locale)),
      pagination: formatPagination(results.found, results.page, limit),
    });
  },
);

export default genresSearchRoutes;
