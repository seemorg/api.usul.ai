import { db } from '@/lib/db';
import type { PathLocale } from '@/lib/locale';
import { env } from '@/env';
import { makeBookDto } from '@/dto/book.dto';
import type { FetchBookResponse } from '@/book-fetchers';

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

export const getBookById = async (id: string, locale: PathLocale = 'en') => {
  const book =
    env.NODE_ENV === 'development'
      ? await db.book.findFirst({
          where: { id },
          include: {
            genres: {
              select: { id: true },
            },
            primaryNameTranslations: true,
            otherNameTranslations: true,
          },
        })
      : bookIdToBook?.[id];

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
let bookIdToBook: Record<string, RawBook> | null = null;
export const populateBooks = async () => {
  const books = await get();

  if (!bookSlugToBook) bookSlugToBook = {};
  if (!bookIdToBook) bookIdToBook = {};

  for (const book of books) {
    bookSlugToBook[book.slug] = book;
    bookIdToBook[book.id] = book;
  }
};

export const getBookVersionDetails = (
  bookContent: FetchBookResponse,
  fields: ('headings' | 'publication_details')[],
) => {
  const includeHeadings = fields.includes('headings');
  const includePublicationDetails = fields.includes('publication_details');

  const final: { publicationDetails?: PrismaJson.PublicationDetails; headings?: any } =
    {};

  if (includePublicationDetails) {
    final.publicationDetails = bookContent.publicationDetails ?? {};
  }

  if (includeHeadings) {
    if (bookContent.source === 'turath') {
      final.headings = bookContent.headings;
    }

    if (bookContent.source === 'openiti') {
      final.headings = bookContent.chapters;
    }
  }

  return final;
};

export const getBookContentIndexByPage = (
  bookContent: FetchBookResponse,
  page: number,
  volume?: string,
) => {
  if (bookContent.source === 'turath') {
    return bookContent.pages.findIndex(p => p.vol === volume && p.page === page);
  }

  if (bookContent.source === 'openiti') {
    return bookContent.content.findIndex(
      p => p.page === page && (!volume ? !p.volume : String(p.volume) === volume),
    );
  }

  return -1;
};

export const paginateBookContent = (
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

  const extraFields = getBookVersionDetails(bookContent, fieldsArray as any);

  if (bookContent.source === 'turath') {
    return {
      content: {
        id: bookContent.id,
        source: bookContent.source,
        pages: bookContent.pages.slice(startIndex, end),
        ...(fieldsArray.includes('pdf') ? { pdf: bookContent.pdf } : {}),
        ...extraFields,
      },
      pagination: {
        ...basePaginationInfo,
        total: bookContent?.pages.length,
      },
    };
  }

  if (bookContent.source === 'openiti') {
    return {
      content: {
        id: bookContent.id,
        version: bookContent.version,
        source: bookContent.source,
        pages: bookContent.content.slice(startIndex, end),
        ...extraFields,
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
        id: bookContent.id,
        source: bookContent.source,
        url: bookContent.url,
        ...extraFields,
      },
    };
  }

  if (bookContent.source === 'pdf') {
    return {
      content: {
        id: bookContent.id,
        source: bookContent.source,
        ...extraFields,
      },
    };
  }

  return bookContent;
};
