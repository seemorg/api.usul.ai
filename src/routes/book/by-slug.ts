import { getCachedBookContent } from '@/lib/content';
import { getBookByAlternateSlug } from '@/services/alternate-slugs';
import { getBookById, getBookBySlug, paginateBookContent } from '@/services/book';
import { localeSchema } from '@/validators/locale';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const bySlugRoutes = new Hono();

bySlugRoutes.get(
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

    const paginatedResult = paginateBookContent(bookContent, startIndex, size, fields);

    return c.json({
      book: includeBook ? book : undefined,
      content: paginatedResult.content,
      pagination: paginatedResult.pagination,
    });
  },
);

export default bySlugRoutes;
