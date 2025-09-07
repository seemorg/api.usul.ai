import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import {
  commonSearchSchema,
  formatAuthor,
  formatPagination,
  formatResults,
  prepareQuery,
  weightsMapToQueryWeights,
} from './utils';
import { z } from 'zod';
import { typesense } from '@/lib/typesense';
import { TypesenseAuthorDocument } from '@/types/typesense/author';
import { authorQueryWeights, AUTHORS_COLLECTION } from '@/lib/typesense/collections';

const authorSearchRoutes = new Hono();

authorSearchRoutes.get(
  '/authors',
  zValidator(
    'query',
    commonSearchSchema.extend({
      regions: z
        .string()
        .transform(val => val.split(','))
        .pipe(z.array(z.string()))
        .optional(),
      yearRange: z
        .string()
        .transform(val => val.split(','))
        .pipe(z.tuple([z.coerce.number(), z.coerce.number()]))
        .optional(),
      ids: z
        .string()
        .transform(val => val.split(','))
        .pipe(z.array(z.string()))
        .optional(),
      sortBy: z
        .enum([
          'relevance',
          'year-asc',
          'year-desc',
          'texts-asc',
          'texts-desc',
          'alphabetical-asc',
          'alphabetical-desc',
        ])
        .optional(),
    }),
  ),
  async c => {
    const { q, limit, page, sortBy, regions, yearRange, ids, locale } =
      c.req.valid('query');

    const filters: string[] = [];

    if (regions && regions.length > 0) {
      filters.push(`regions:[${regions.map(region => `\`${region}\``).join(', ')}]`);
    }
    if (yearRange) {
      filters.push(`year:[${yearRange[0]}..${yearRange[1]}]`);
    }
    if (ids && ids.length > 0) {
      filters.push(`id:[${ids.map(id => `\`${id}\``).join(', ')}]`);
    }

    const results = await typesense
      .collections<TypesenseAuthorDocument>(AUTHORS_COLLECTION.INDEX)
      .documents()
      .search({
        q: prepareQuery(q),
        query_by: Object.values(authorQueryWeights).flat(),
        query_by_weights: weightsMapToQueryWeights(authorQueryWeights),
        prioritize_token_position: true,
        limit,
        page,
        ...(filters.length > 0 && { filter_by: filters.join(' && ') }),
        ...(sortBy &&
          sortBy !== 'relevance' && {
            sort_by: {
              'year-asc': 'year:asc',
              'year-desc': 'year:desc',
              'texts-asc': 'booksCount:asc',
              'texts-desc': 'booksCount:desc',
              'alphabetical-asc': 'transliteration:asc',
              'alphabetical-desc': 'transliteration:desc',
            }[sortBy],
          }),
      });

    return c.json({
      results: formatResults(results, 'author', author => formatAuthor(author, locale)),
      pagination: formatPagination(results.found, results.page, limit),
    });
  },
);

export default authorSearchRoutes;
