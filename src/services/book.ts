import { db } from '@/lib/db';
import type { PathLocale } from '@/lib/locale';
import { env } from '@/env';
import { makeBookDto } from '@/dto/book.dto';
import type { FetchBookResponse } from '@/book-fetchers';
import fs from 'fs';
import centuries from '../data/centuries.json';
import path from 'path';

export const getBookBySlug = (slug: string, locale: PathLocale = 'en') => {
  const book = bookSlugToBook?.[slug];
  if (!book) return null;

  return makeBookDto(book, locale);
};

export const getBookById = (id: string, locale: PathLocale = 'en') => {
  const book = bookIdToBook?.[id];
  if (!book) return null;

  return makeBookDto(book, locale);
};

export const getBooksByAuthorId = (authorId: string, locale: PathLocale = 'en') => {
  const entries = authorIdToBooks?.[authorId];
  if (!entries) return [];

  return entries.map(book => makeBookDto(book, locale));
};

export const getBooksByGenreId = (genreId: string, locale: PathLocale = 'en') => {
  const entries = genreIdToBooks?.[genreId];
  if (!entries) return [];

  return entries.map(book => makeBookDto(book, locale));
};

export const getBookCount = async () => {
  if (bookIdToBook) {
    return Object.keys(bookIdToBook).length;
  }

  return db.book.count();
};

export const getAllCenturies = () => {
  if (!bookIdToBook) return [];
  const books = Object.values(bookIdToBook).map(book => makeBookDto(book, 'en'));

  const results: Record<number, number> = {};
  for (const book of books) {
    if (!book.author.year || book.author.year <= -1 || book.author.year > 1500) continue;
    const century = Math.floor(book.author.year / 100) + 1;

    results[century] = (results[century] ?? 0) + 1;
  }

  return Object.entries(results).map(([century, count]) => {
    const centuryNumber = Number(century);

    return {
      yearFrom: (centuryNumber - 1) * 100,
      yearTo: centuryNumber * 100,
      description:
        (centuries as Record<string, { summary: string }>)[century]?.summary ?? null,
      centuryNumber,
      totalBooks: count,
    };
  });
};

export const getAllBooks = (
  locale: PathLocale = 'en',
  params?: {
    authorId?: string;
    bookIds?: string[];
    yearRange?: [number, number];
    regionId?: string;
    genreId?: string;
  },
  dtoParams: { includeLocations?: boolean } = {},
) => {
  let books = Object.values(bookIdToBook ?? {}).map(book =>
    makeBookDto(
      book,
      locale,
      (params && params.regionId) || dtoParams.includeLocations
        ? { includeLocations: true }
        : {},
    ),
  );

  if (params) {
    if (params.authorId) {
      books = books.filter(book => book.author.id === params.authorId);
    }
    if (params.bookIds) {
      books = books.filter(book => params.bookIds!.includes(book.id));
    }
    if (params.yearRange) {
      books = books.filter(
        book =>
          book.author.year !== undefined &&
          book.author.year !== null &&
          book.author.year >= 0 &&
          book.author.year >= params.yearRange![0] &&
          book.author.year <= params.yearRange![1],
      );
    }
    if (params.regionId) {
      books = books.filter(book =>
        book.author.locations?.some(location => location?.regionId === params.regionId),
      );
    }
    if (params.genreId) {
      books = books.filter(book =>
        book.genres.some(genre => genre.id === params.genreId),
      );
    }
  }

  return books;
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
let authorIdToBooks: Record<string, RawBook[]> | null = null;
let genreIdToBooks: Record<string, RawBook[]> | null = null;

export const populateBooks = async () => {
  let books: Awaited<ReturnType<typeof get>> | undefined;
  const filePath = path.resolve('.cache/books.json');
  if (env.NODE_ENV === 'development') {
    // load from local
    if (fs.existsSync(filePath)) {
      books = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  }

  if (!books) {
    books = await get();
    if (env.NODE_ENV === 'development') {
      // write to cache
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(books), 'utf-8');
    }
  }

  bookSlugToBook = {};
  bookIdToBook = {};
  authorIdToBooks = {};
  genreIdToBooks = {};

  for (const book of books) {
    bookSlugToBook[book.slug] = book;
    bookIdToBook[book.id] = book;

    authorIdToBooks[book.authorId] = [...(authorIdToBooks[book.authorId] ?? []), book];
    book.genres.forEach(genre => {
      genreIdToBooks![genre.id] = [...(genreIdToBooks![genre.id] ?? []), book];
    });
  }
};

export const getBookVersionDetails = (
  bookContent: FetchBookResponse,
  fields: string[],
) => {
  const includeHeadings = fields.includes('headings');
  const includePublicationDetails = fields.includes('publication_details');
  const includePdf = fields.includes('pdf');

  const final: {
    publicationDetails?: PrismaJson.PublicationDetails;
    pdfUrl?: string;
    headings?: any;
  } = {};

  if (includePublicationDetails) {
    final.publicationDetails = bookContent.publicationDetails ?? {};
  }

  if (includePdf && 'pdfUrl' in bookContent) {
    final.pdfUrl = bookContent.pdfUrl;
  }

  if (includeHeadings) {
    if (bookContent.source === 'turath') {
      final.headings = bookContent.headings;
    }

    if (bookContent.source === 'openiti') {
      final.headings = bookContent.chapters;
    }

    if (bookContent.source === 'pdf' && 'headings' in bookContent) {
      final.headings = bookContent.headings;
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

  const extraFields = getBookVersionDetails(bookContent, fieldsArray);

  if (bookContent.source === 'turath') {
    return {
      content: {
        id: bookContent.id,
        version: bookContent.version,
        source: bookContent.source,
        pages: bookContent.pages.slice(startIndex, end),
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

  if (bookContent.source === 'pdf') {
    const isDigital = 'pages' in bookContent;
    return {
      content: {
        id: bookContent.id,
        source: bookContent.source,
        url: bookContent.url,
        ...(isDigital && {
          pages: bookContent.pages.slice(startIndex, end),
        }),
        ...extraFields,
      },
      ...(isDigital && {
        pagination: {
          ...basePaginationInfo,
          total: bookContent.pages.length,
        },
      }),
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

  return bookContent;
};
