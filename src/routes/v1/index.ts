import { env } from '@/env';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { bearerAuth } from 'hono/bearer-auth';
import { z } from 'zod';
import { BookDetailsResponse, getBookDetails } from '../book/details';
import { searchBook } from '@/book-search/search';

const v1Routes = new Hono();
v1Routes.use(bearerAuth({ token: env.ANSARI_API_KEY }));

const schema = z.object({
  q: z.string().min(1),
  include_chapters: z.coerce.boolean().optional().default(false),
  include_details: z.coerce.boolean().optional().default(false),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(50).optional().default(10),
});

type BookDetails = BookDetailsResponse & {
  sourceAndVersion: string;
  versionId: string;
};

async function loadBooksDetails(books: { id: string; versionId?: string }[]) {
  const bookDetails: Record<string, BookDetails> = {};
  const booksToSearch: {
    id: string;
    sourceAndVersion: string;
  }[] = [];

  const results = await Promise.all(
    books.map(
      async b => {
        const data = await getBookDetails(b.id).catch(() => null);

        if (!data || 'type' in data) {
          return null;
        }

        const version = data.book.versions.find(v =>
          b.versionId ? v.id === b.versionId : v.aiSupported,
        );

        if (!version) {
          return null;
        }

        return {
          ...data,
          sourceAndVersion: `${version.source}:${version.value}`,
          versionId: version.id,
        };
      },
      {} as Record<string, BookDetails>,
    ),
  );
  const filteredResults = results.filter(Boolean) as NonNullable<
    (typeof results)[number]
  >[];

  for (const result of filteredResults) {
    const searchEntry = {
      id: result.book.id,
      sourceAndVersion: result.sourceAndVersion,
    };

    bookDetails[`${result.book.id}:${result.sourceAndVersion}`] = result;
    booksToSearch.push(searchEntry);
  }

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

  let detailsResult: Awaited<ReturnType<typeof loadBooksDetails>> | undefined;
  if (books) {
    detailsResult = await loadBooksDetails(books);
  }

  const results = await searchBook({
    books: detailsResult ? detailsResult.booksToSearch : undefined,
    query,
    type,
    limit,
    page,
  });

  // fetch the details for the books returned
  if (params.include_details && !detailsResult) {
    const booksToSearch: string[] = [];

    for (const result of results.results) {
      const bookId = result.node.metadata.bookId;
      if (!booksToSearch.includes(bookId)) {
        booksToSearch.push(bookId);
      }
    }

    detailsResult = await loadBooksDetails(booksToSearch.map(id => ({ id })));
  }

  return {
    ...results,
    results: results.results.map(r => {
      const includeHighlights =
        type === 'text' && r.node.highlights && r.node.highlights.length > 0;

      const sourceAndVersion = r.node.metadata.sourceAndVersion;
      const details = detailsResult
        ? detailsResult.bookDetails[`${r.node.metadata.bookId}:${sourceAndVersion}`]
        : null;

      return {
        ...r,
        node: {
          ...r.node,
          text: includeHighlights ? undefined : r.node.text,
          metadata: {
            ...r.node.metadata,
            versionId: details ? details.versionId : undefined,
            sourceAndVersion: undefined, // don't send it to the client
            version: details
              ? undefined
              : {
                  source: sourceAndVersion.split(':')[0],
                  value: sourceAndVersion.split(':')[1],
                }, // don't send it to the client
            chapters:
              params.include_chapters && details
                ? r.node.metadata.chapters.map(chapterIdx => details.headings[chapterIdx])
                : undefined,
          },
          ...(params.include_details &&
            details && {
              book: {
                slug: details.book.slug,
                primaryName: details.book.primaryName,
                secondaryName: details.book.secondaryName,
                transliteration: details.book.transliteration,
                author: {
                  slug: details.book.author.slug,
                  primaryName: details.book.author.primaryName,
                  secondaryName: details.book.author.secondaryName,
                  transliteration: details.book.author.transliteration,
                  year: details.book.author.year,
                },
              },
              versionId: details.versionId,
            }),
          highlights: includeHighlights ? r.node.highlights : undefined,
        },
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
  '/keyword-search',
  zValidator(
    'query',
    schema.extend({
      books: booksSchema,
    }),
  ),
  async c => {
    const { books, ...params } = c.req.valid('query');
    const results = await search(params, 'text', books);

    return c.json(results);
  },
);

v1Routes.get(
  '/vector-search',
  zValidator(
    'query',
    schema.extend({
      books: booksSchema,
    }),
  ),
  async c => {
    const { books, ...params } = c.req.valid('query');
    const results = await search(params, 'vector', books);

    return c.json(results);
  },
);

export default v1Routes;
