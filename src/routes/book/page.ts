import { getCachedBookContent } from '@/lib/content';
import { getBookByAlternateSlug } from '@/services/alternate-slugs';
import {
  getBookById,
  getBookBySlug,
  getBookContentIndexByPage,
  paginateBookContent,
} from '@/services/book';
import { localeSchema } from '@/validators/locale';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const pageRoutes = new Hono();

pageRoutes.get(
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

    const book = getBookBySlug(bookSlug, locale);
    if (!book) {
      const alternateSlugBookId = getBookByAlternateSlug(bookSlug);
      if (alternateSlugBookId) {
        const primarySlug = getBookById(alternateSlugBookId, locale)?.slug;
        if (primarySlug) {
          return c.json({ type: 'alternate-slug', primarySlug });
        }
      }

      throw new HTTPException(404, { message: 'Book not found' });
    }

    if (book.versions.length === 0) {
      return c.json({
        book: includeBook ? book : undefined,
        content: {},
        pagination: {
          total: 0,
          startIndex: index,
          size: 0,
        },
      });
    }

    const bookContent = await getCachedBookContent(book.id, versionId, locale);

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

pageRoutes.get(
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
      const alternateSlugBookId = getBookByAlternateSlug(bookSlug);
      if (alternateSlugBookId) {
        const primarySlug = (await getBookById(alternateSlugBookId, locale))?.slug;
        if (primarySlug) {
          return c.json({ type: 'alternate-slug', primarySlug });
        }
      }

      throw new HTTPException(404, { message: 'Book not found' });
    }

    const bookContent = await getCachedBookContent(book.id, versionId, locale);

    if (!bookContent) {
      throw new HTTPException(404, { message: 'Could not fetch book content' });
    }

    const index = getBookContentIndexByPage(bookContent, page, volume);

    return c.json({
      index: index === -1 ? null : index,
    });
  },
);

export default pageRoutes;
