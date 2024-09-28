import { db } from '@/lib/db';
import { PathLocale } from '@/lib/locale';
import { env } from '@/env';
import { makeBookDto } from '@/dto/book.dto';

export const getBookBySlug = async (slug: string, locale: PathLocale = 'en') => {
  const book =
    env.NODE_ENV === 'development'
      ? await db.book.findFirst({
          where: { slug },
          include: {
            genres: {
              select: { id: true },
            },
            primaryNameTranslations: true,
            otherNameTranslations: true,
          },
        })
      : bookSlugToBook?.[slug];

  if (!book) return null;

  return makeBookDto(book, locale);
};

const get = () =>
  db.book.findMany({
    include: {
      genres: {
        select: { id: true },
      },
      primaryNameTranslations: true,
      otherNameTranslations: true,
    },
  });

type RawBook = Awaited<ReturnType<typeof get>>[number];

let bookSlugToBook: Record<string, RawBook> | null = null;
export const populateBooks = async () => {
  if (bookSlugToBook) return;

  const books = await get();
  bookSlugToBook = books.reduce((acc, book) => {
    acc[book.slug] = book;
    return acc;
  }, {} as Record<string, RawBook>);
};
