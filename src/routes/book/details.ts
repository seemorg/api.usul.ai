import { getCachedBookContent } from '@/lib/content';
import { PathLocale } from '@/lib/locale';
import { getBookByAlternateSlug } from '@/services/alternate-slugs';
import { getBookById, getBookBySlug, getBookVersionDetails } from '@/services/book';
import { localeSchema } from '@/validators/locale';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const bookDetailsRoutes = new Hono();

export const getBookDetails = async (bookSlug: string, locale?: PathLocale) => {
  const book =
    (await getBookBySlug(bookSlug, locale)) ?? (await getBookById(bookSlug, locale));
  if (!book) {
    const alternateSlugBookId = getBookByAlternateSlug(bookSlug);
    if (alternateSlugBookId) {
      const primarySlug = (await getBookById(alternateSlugBookId, locale))?.slug;
      if (primarySlug) {
        return { type: 'alternate-slug', primarySlug };
      }
    }

    throw new HTTPException(404, { message: 'Book not found' });
  }

  const aiSupportedVersion = book.versions.find(
    version => version.aiSupported || version.keywordSupported,
  );
  if (!aiSupportedVersion) {
    throw new HTTPException(400, { message: 'AI is not supported for this book' });
  }

  const bookContent = await getCachedBookContent(book.id, aiSupportedVersion.id, locale);

  if (!bookContent) {
    throw new HTTPException(404, { message: 'Could not fetch book content' });
  }

  const details = getBookVersionDetails(bookContent, ['headings', 'publication_details']);

  return {
    book,
    ...details,
  };
};

export type BookDetailsResponse = Exclude<
  Awaited<ReturnType<typeof getBookDetails>>,
  { type: string }
>;

bookDetailsRoutes.get(
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
    const result = await getBookDetails(bookSlug, locale);

    return c.json(result);
  },
);

export default bookDetailsRoutes;
