import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import {
  commonSearchSchema,
  formatAuthor,
  formatBook,
  formatGenre,
  formatResults,
  prepareQuery,
  weightsMapToQueryWeights,
} from './utils';
import { typesense } from '@/lib/typesense';
import {
  authorQueryWeights,
  AUTHORS_COLLECTION,
  BOOKS_COLLECTION,
  booksQueryWeights,
  GENRES_COLLECTION,
  genresQueryWeights,
} from '@/lib/typesense/collections';
import { TypesenseAuthorDocument } from '@/types/typesense/author';
import { TypesenseBookDocument } from '@/types/typesense/book';
import { TypesenseGenreDocument } from '@/types/typesense/genre';
import { searchBook } from '@/book-search/search';
import { getBookById } from '@/services/book';

const globalSearchRoutes = new Hono();

globalSearchRoutes.get(
  '/',
  zValidator('query', commonSearchSchema.omit({ page: true, limit: true })),
  async c => {
    const { q, locale } = c.req.valid('query');

    const [typesenseResults, keywordResults] = await Promise.all([
      typesense.multiSearch.perform<
        [TypesenseAuthorDocument, TypesenseBookDocument, TypesenseGenreDocument]
      >({
        searches: [
          {
            collection: AUTHORS_COLLECTION.INDEX,
            q: prepareQuery(q),
            query_by: Object.values(authorQueryWeights).flat(),
            query_by_weights: weightsMapToQueryWeights(authorQueryWeights),
            prioritize_token_position: true,
            limit: 5,
            page: 1,
          },
          {
            collection: BOOKS_COLLECTION.INDEX,
            q: prepareQuery(q),
            query_by: Object.values(booksQueryWeights).flat(),
            query_by_weights: weightsMapToQueryWeights(booksQueryWeights),
            prioritize_token_position: true,
            limit: 10,
            page: 1,
          },
          {
            collection: GENRES_COLLECTION.INDEX,
            q: prepareQuery(q),
            query_by: Object.values(genresQueryWeights).flat(),
            query_by_weights: weightsMapToQueryWeights(genresQueryWeights),
            prioritize_token_position: true,
            limit: 5,
            page: 1,
          },
        ],
      }),
      searchBook({
        query: q,
        type: 'text',
        limit: 10,
        page: 1,
        rerank: false,
      }),
    ]);

    const authors = typesenseResults.results[0];
    const books = typesenseResults.results[1];
    const genres = typesenseResults.results[2];

    return c.json({
      content: {
        total: keywordResults.total,
        results: keywordResults.results
          .map(result => {
            const book = getBookById(result.node.metadata.bookId, locale);
            if (!book) return null;

            const version = book.versions.find(
              v => v.value === result.node.metadata.sourceAndVersion.split(':')[1],
            );

            return {
              versionId: version?.id,
              book: {
                id: book.id,
                slug: book.slug,
                primaryName: book.primaryName,
                secondaryName: book.secondaryName,
                author: {
                  id: book.author.id,
                  primaryName: book.author.primaryName,
                  secondaryName: book.author.secondaryName,
                  year: book.author.year,
                },
              },
              node: result.node,
            };
          })
          .filter(Boolean),
      },
      books: formatResults(books, 'book', book => formatBook(book, locale)),
      authors: formatResults(authors, 'author', author => formatAuthor(author, locale)),
      genres: formatResults(genres, 'genre', genre => formatGenre(genre, locale)),
    });
  },
);

export default globalSearchRoutes;
