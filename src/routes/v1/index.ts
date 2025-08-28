import { env } from '@/env';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { bearerAuth } from 'hono/bearer-auth';
import { z } from 'zod';
import { searchBook } from '@/book-search/search';
import { getBookById } from '@/services/book';
import { BookDto } from '@/dto/book.dto';

const v1Routes = new Hono();

const stringBoolean = z.enum(['true', 'false']).transform(value => value === 'true');

const schema = z.object({
  q: z.string().min(1),
  include_chapters: stringBoolean.optional().default('false'),
  include_details: stringBoolean.optional().default('false'),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(50).optional().default(10),
});

function loadBooksDetails(
  books: { id: string; versionId?: string }[],
  type: 'text' | 'vector',
) {
  const bookDetails = books.reduce(
    (acc, b) => {
      const book = getBookById(b.id);

      if (!book) return acc;

      const version = book.versions.find(v =>
        b.versionId
          ? v.id === b.versionId
          : type === 'vector'
            ? v.aiSupported
            : v.keywordSupported,
      );

      if (!version) return acc;

      acc[b.id] = {
        ...book,
        sourceAndVersion: `${version.source}:${version.value}`,
        versionId: version.id,
      };

      return acc;
    },
    {} as Record<string, BookDto & { sourceAndVersion: string; versionId: string }>,
  );

  const booksToSearch: {
    id: string;
    sourceAndVersion: string;
  }[] = Object.values(bookDetails).map(b => ({
    id: b.id,
    sourceAndVersion: b.sourceAndVersion,
  }));

  return { bookDetails, booksToSearch };
}

async function search(
  params: z.infer<typeof schema>,
  type: 'vector' | 'text',
  books?: {
    id: string;
    versionId: string;
  }[],
) {
  const { q: query, limit, page } = params;

  let detailsResult: ReturnType<typeof loadBooksDetails> | undefined;
  if (books) detailsResult = loadBooksDetails(books, type);

  const results = await searchBook({
    books: detailsResult ? detailsResult.booksToSearch : undefined,
    query,
    type,
    limit,
    page,
    rerank: false,
  });

  // fetch the details for the books returned
  if (!detailsResult) {
    const booksToSearch = [
      ...new Set<string>(results.results.map(r => r.node.metadata.bookId)),
    ];
    detailsResult = loadBooksDetails(
      booksToSearch.map(id => ({ id })),
      type,
    );
  }

  return {
    ...results,
    results: results.results
      .filter(r => r.node.metadata.bookId in detailsResult.bookDetails)
      .map(r => {
        const includeHighlights =
          type === 'text' && r.node.highlights && r.node.highlights.length > 0;
        const book = detailsResult.bookDetails[r.node.metadata.bookId]!;

        return {
          ...r,
          versionId: book.versionId,
          node: {
            ...r.node,
            text: includeHighlights ? undefined : r.node.text,
            metadata: {
              ...r.node.metadata,
              // don't send chapters if they are not requested
              ...(!params.include_chapters
                ? {
                    chapters: undefined,
                  }
                : {}),
              sourceAndVersion: undefined, // don't send it to the client
            },
            highlights: includeHighlights ? r.node.highlights : undefined,
          },
          ...(params.include_details && {
            book: {
              id: book.id,
              slug: book.slug,
              primaryName: book.primaryName,
              secondaryName: book.secondaryName,
              author: {
                id: book.author.id,
                slug: book.author.slug,
                primaryName: book.author.primaryName,
                secondaryName: book.author.secondaryName,
                year: book.author.year,
              },
            },
          }),
        };
      }),
  };
}

const booksSchema = z
  .string()
  .optional()
  .transform(value => {
    let books:
      | {
          id: string;
          versionId: string;
        }[]
      | undefined;
    if (value) {
      books = value.split(',').map(pair => {
        const [bookId, versionId] = pair.split(':');
        return {
          id: bookId,
          versionId,
        };
      });
    }

    return books;
  });

v1Routes.get(
  '/vector-search/:bookId/:versionId',
  bearerAuth({ token: env.ANSARI_API_KEY }),
  zValidator('query', schema),
  async c => {
    const bookId = c.req.param('bookId');
    const versionId = c.req.param('versionId');
    const params = c.req.valid('query');

    const results = await search(params, 'vector', [
      {
        id: bookId,
        versionId,
      },
    ]);

    return c.json(results);
  },
);

v1Routes.get(
  '/content-search',
  zValidator(
    'query',
    schema.extend({
      books: booksSchema,
      type: z.enum(['text', 'vector']),
    }),
  ),
  async c => {
    const { books, type, ...params } = c.req.valid('query');
    const results = await search(params, type, books);

    return c.json(results);
  },
);

export default v1Routes;
