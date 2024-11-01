import { fetchBookContent, type FetchBookResponse } from '@/book-fetchers';
import {
  getBookBySlug,
  getBookContentIndexByPage,
  getBookVersionDetails,
  paginateBookContent,
} from '@/services/book';
import { localeSchema } from '@/validators/locale';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { LRUCache } from 'lru-cache';
import type { PathLocale } from '@/lib/locale';

const bookRoutes = new Hono().basePath('/book');

const contentCache = new LRUCache<string, FetchBookResponse>({
  max: 500,
  fetchMethod: async key => {
    const { slug, versionId, locale } = parseCacheKey(key);
    const book = await getBookBySlug(slug, locale);
    if (!book) {
      return;
    }

    const bookContent = await fetchBookContent(book, versionId);
    if (!bookContent) {
      return;
    }

    return bookContent;
  },
});

const makeCacheKey = (bookSlug: string, versionId?: string, locale?: PathLocale) => {
  return `${bookSlug}_:_${versionId ?? ''}_:_${locale ?? ''}`;
};

const parseCacheKey = (key: string) => {
  const [slug, versionId, locale] = key.split('_:_');
  return {
    slug,
    versionId: versionId === '' ? undefined : versionId,
    locale: locale === '' ? undefined : (locale as PathLocale),
  };
};

bookRoutes.get(
  '/details/:bookSlug',
  zValidator('param', z.object({ bookSlug: z.string() })),
  zValidator(
    'query',
    z.object({
      locale: localeSchema,
    }),
  ),
  async c => {
    const { bookSlug } = c.req.valid('param');
    const { locale } = c.req.valid('query');

    const book = await getBookBySlug(bookSlug, locale);
    if (!book) {
      throw new HTTPException(404, { message: 'Book not found' });
    }

    if (!book.flags.aiSupported || !book.flags.aiVersion) {
      throw new HTTPException(400, { message: 'AI is not supported for this book' });
    }

    // get the ai version
    const versionId = book.flags.aiVersion;

    const bookContent = await contentCache.fetch(
      makeCacheKey(bookSlug, versionId, locale),
    );

    if (!bookContent) {
      throw new HTTPException(404, { message: 'Could not fetch book content' });
    }

    const details = getBookVersionDetails(bookContent, [
      'headings',
      'publication_details',
    ]);

    return c.json({
      book,
      ...details,
    });
  },
);

bookRoutes.get(
  '/page/:bookSlug',
  zValidator('param', z.object({ bookSlug: z.string() })),
  zValidator(
    'query',
    z.object({
      versionId: z.string().optional(),
      locale: localeSchema,
      includeBook: z.coerce.boolean().optional().default(false),
      fields: z.string().optional(), // comma separated list of fields
      index: z.coerce.number().min(0),
    }),
  ),
  async c => {
    const { bookSlug } = c.req.valid('param');
    const { versionId, locale, includeBook, fields, index } = c.req.valid('query');

    const book = await getBookBySlug(bookSlug, locale);
    if (!book) {
      throw new HTTPException(404, { message: 'Book not found' });
    }

    const bookContent = await contentCache.fetch(
      makeCacheKey(bookSlug, versionId, locale),
    );

    if (!bookContent) {
      throw new HTTPException(404, { message: 'Could not fetch book content' });
    }

    const paginatedResult = paginateBookContent(bookContent, index, 1, fields);

    return c.json({
      book: includeBook ? book : undefined,
      content: paginatedResult.content,
      pagination: paginatedResult.pagination,
    });
  },
);

bookRoutes.get(
  '/page_index/:bookSlug',
  zValidator('param', z.object({ bookSlug: z.string() })),
  zValidator(
    'query',
    z.object({
      versionId: z.string().optional(),
      page: z.coerce.number().min(1),
      volume: z.string().optional(),
    }),
  ),
  async c => {
    const { bookSlug } = c.req.valid('param');
    const { versionId, page, volume } = c.req.valid('query');
    const locale = 'en';

    const book = await getBookBySlug(bookSlug, locale);
    if (!book) {
      throw new HTTPException(404, { message: 'Book not found' });
    }

    const bookContent = await contentCache.fetch(
      makeCacheKey(bookSlug, versionId, locale),
    );

    if (!bookContent) {
      throw new HTTPException(404, { message: 'Could not fetch book content' });
    }

    const index = getBookContentIndexByPage(bookContent, page, volume);

    return c.json({
      index: index === -1 ? null : index,
    });
  },
);

bookRoutes.get(
  '/:bookSlug',
  zValidator('param', z.object({ bookSlug: z.string() })),
  zValidator(
    'query',
    z.object({
      versionId: z.string().optional(),
      locale: localeSchema,
      startIndex: z.coerce.number().optional().default(0),
      size: z.coerce.number().optional().default(10),
      includeBook: z.coerce.boolean().optional().default(false),
      fields: z.string().optional(), // comma separated list of fields
    }),
  ),
  async c => {
    const { bookSlug } = c.req.valid('param');
    const { versionId, locale, startIndex, size, includeBook, fields } =
      c.req.valid('query');

    const book = await getBookBySlug(bookSlug, locale);
    if (!book) {
      throw new HTTPException(404, { message: 'Book not found' });
    }

    const bookContent = await contentCache.fetch(
      makeCacheKey(bookSlug, versionId, locale),
    );

    if (!bookContent) {
      throw new HTTPException(404, { message: 'Could not fetch book content' });
    }

    const paginatedResult = paginateBookContent(bookContent, startIndex, size, fields);

    return c.json({
      book: includeBook ? book : undefined,
      content: paginatedResult.content,
      pagination: paginatedResult.pagination,
    });
  },
);

export default bookRoutes;
