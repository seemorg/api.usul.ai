import { typesense } from '@/lib/typesense';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  commonSearchSchema,
  formatAuthor,
  formatBook,
  formatPagination,
  formatResults,
  prepareQuery,
  weightsMapToQueryWeights,
} from './utils';
import { AUTHORS_COLLECTION } from '@/lib/typesense/collections';
import { TypesenseBookDocument } from '@/types/typesense/book';
import { TypesenseAuthorDocument } from '@/types/typesense/author';
import { SearchResponse } from 'typesense/lib/Typesense/Documents';
import { BOOKS_COLLECTION, booksQueryWeights } from '@/lib/typesense/collections';

const bookSearchRoutes = new Hono();

bookSearchRoutes.get(
  '/books',
  zValidator(
    'query',
    commonSearchSchema.extend({
      genres: z
        .string()
        .transform(val => val.split(','))
        .pipe(z.array(z.string()))
        .optional(),
      authors: z
        .string()
        .transform(val => val.split(','))
        .pipe(z.array(z.string()))
        .optional(),
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
          'alphabetical-asc',
          'alphabetical-desc',
        ])
        .optional(),
    }),
  ),
  async c => {
    const { q, limit, page, sortBy, genres, authors, regions, yearRange, ids, locale } =
      c.req.valid('query');

    const filters: string[] = [];

    if (genres && genres.length > 0) {
      filters.push(`genreIds:[${genres.map(genre => `\`${genre}\``).join(', ')}]`);
    }
    if (authors && authors.length > 0) {
      filters.push(`authorId:[${authors.map(id => `\`${id}\``).join(', ')}]`);
    }
    if (regions && regions.length > 0) {
      filters.push(`regions:[${regions.map(region => `\`${region}\``).join(', ')}]`);
    }
    if (yearRange) {
      filters.push(`year:[${yearRange[0]}..${yearRange[1]}]`);
    }
    if (ids && ids.length > 0) {
      filters.push(`id:[${ids.map(id => `\`${id}\``).join(', ')}]`);
    }

    const results = await typesense.multiSearch.perform<
      (TypesenseBookDocument | TypesenseAuthorDocument)[]
    >({
      searches: [
        {
          collection: BOOKS_COLLECTION.INDEX,
          q: prepareQuery(q),
          query_by: Object.values(booksQueryWeights).flat(),
          query_by_weights: weightsMapToQueryWeights(booksQueryWeights),
          prioritize_token_position: true,
          limit,
          page,
          ...(filters.length > 0 && { filter_by: filters.join(' && ') }),
          ...(sortBy && sortBy !== 'relevance'
            ? {
                sort_by: {
                  'year-asc': 'year:asc',
                  'year-desc': 'year:desc',
                  'alphabetical-asc': 'transliteration:asc',
                  'alphabetical-desc': 'transliteration:desc',
                }[sortBy],
              }
            : {}),
        },
        ...(authors && authors.length > 0
          ? [
              {
                collection: AUTHORS_COLLECTION.INDEX,
                q: '',
                query_by: 'primaryNames.text',
                limit: 100,
                page: 1,
                filter_by: `id:[${authors.map(id => `\`${id}\``).join(', ')}]`,
              },
            ]
          : []),
      ],
    });

    const [booksResults, selectedAuthorsResults] = results.results;

    return c.json({
      results: formatResults(
        booksResults as SearchResponse<TypesenseBookDocument>,
        'book',
        book => formatBook(book, locale),
      ),
      pagination: formatPagination(booksResults.found, booksResults.page, limit),
      selectedAuthors: selectedAuthorsResults
        ? formatResults(
            selectedAuthorsResults as SearchResponse<TypesenseAuthorDocument>,
            'author',
            author => formatAuthor(author, locale),
          )
        : null,
    });
  },
);

export default bookSearchRoutes;
