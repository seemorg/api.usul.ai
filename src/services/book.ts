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

export const getBookVersionDetails = (
  bookContent: FetchBookResponse,
  fields: ('headings' | 'publication_details')[],
) => {
  const includeHeadings = fields.includes('headings');
  const includePublicationDetails = fields.includes('publication_details');

  if (bookContent.source === 'turath') {
    return {
      ...(includePublicationDetails
        ? { publicationDetails: bookContent.turathResponse.publicationDetails }
        : {}),
      ...(includeHeadings ? { headings: bookContent.turathResponse.headings } : {}),
    };
  }

  if (bookContent.source === 'openiti') {
    return {
      ...(includePublicationDetails ? { publicationDetails: bookContent.metadata } : {}),
      ...(includeHeadings ? { headings: bookContent.chapters } : {}),
    };
  }

  return {};
};

export const getBookContentIndexByPage = (
  bookContent: FetchBookResponse,
  page: number,
  volume?: string,
) => {
  if (bookContent.source === 'turath') {
    return bookContent.turathResponse.pages.findIndex(
      p => p.vol === volume && p.page === page,
    );
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
        source: bookContent.source,
        versionId: bookContent.versionId,
        pages: bookContent.turathResponse.pages.slice(startIndex, end),
        ...(fieldsArray.includes('pdf') ? { pdf: bookContent.turathResponse.pdf } : {}),
        ...extraFields,
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
        source: bookContent.source,
        versionId: bookContent.versionId,
        ...extraFields,
      },
    };
  }

  return bookContent;
};
