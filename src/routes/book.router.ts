import { fetchBookContent, FetchBookResponse } from '@/book-fetchers';
import { getBookBySlug } from '@/services/book';
import { localeSchema } from '@/validators/locale';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { LRUCache } from 'lru-cache';
import { PathLocale } from '@/lib/locale';

const bookRoutes = new Hono();

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
  return `${bookSlug}_:_:${versionId ?? ''}_:_:${locale ?? ''}`;
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

const paginateBookContent = (
  bookContent: FetchBookResponse,
  startIndex: number,
  pageSize: number,
  fields?: string,
) => {
  const end = startIndex + pageSize;
  const fieldsArray = fields?.split(',') ?? [];

  const basePaginationInfo = {
    startIndex,
    size: pageSize,
  };

  if (bookContent.source === 'turath') {
    return {
      content: {
        source: bookContent.source,
        versionId: bookContent.versionId,
        pages: bookContent.turathResponse.pages.slice(startIndex, end),
        ...(fieldsArray.includes('indices')
          ? {
              chapterIndexToPageIndex: bookContent.chapterIndexToPageIndex,
              pageNumberWithVolumeToIndex: bookContent.pageNumberWithVolumeToIndex,
            }
          : {}),
        ...(fieldsArray.includes('pdf') ? { pdf: bookContent.turathResponse.pdf } : {}),
        ...(fieldsArray.includes('publication_details')
          ? { publicationDetails: bookContent.turathResponse.publicationDetails }
          : {}),
        ...(fieldsArray.includes('headings')
          ? { headings: bookContent.turathResponse.headings }
          : {}),
      },
      pagination: {
        ...basePaginationInfo,
        total: bookContent.turathResponse?.pages.length,
      },
    };
  }

  if (bookContent.source === 'openiti') {
    return {
      content: {
        source: bookContent.source,
        versionId: bookContent.versionId,
        rawUrl: bookContent.rawUrl,
        pages: bookContent.content.slice(startIndex, end),
        ...(fieldsArray.includes('publication_details')
          ? { publicationDetails: bookContent.metadata }
          : {}),
        ...(fieldsArray.includes('headings') ? { headings: bookContent.chapters } : {}),
      },
      pagination: {
        ...basePaginationInfo,
        total: bookContent.content.length,
      },
    };
  }

  if (bookContent.source === 'external') {
    return {
      content: {
        source: bookContent.source,
        versionId: bookContent.versionId,
      },
    };
  }

  return bookContent;
};

const getPaginationInfo = (bookContent: FetchBookResponse) => {
  if (bookContent.source === 'turath') {
    return {
      total: bookContent.turathResponse?.pages.length,
    };
  }
};

export default bookRoutes;
