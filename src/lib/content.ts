import { LRUCache } from 'lru-cache';
import type { PathLocale } from '@/lib/locale';
import { fetchBookContent, type FetchBookResponse } from '@/book-fetchers';
import { getBookById } from '@/services/book';

const contentCache = new LRUCache<string, FetchBookResponse>({
  max: 750,
  fetchMethod: async key => {
    const { bookId, versionId, locale } = parseCacheKey(key);
    const book = await getBookById(bookId, locale);

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

const makeCacheKey = (bookId: string, versionId?: string, locale?: PathLocale) => {
  return `${bookId}_:_${versionId ?? ''}_:_${locale ?? ''}`;
};

const parseCacheKey = (key: string) => {
  const [bookId, versionId, locale] = key.split('_:_');
  return {
    bookId,
    versionId: versionId === '' ? undefined : versionId,
    locale: locale === '' ? undefined : (locale as PathLocale),
  };
};

export const getCachedBookContent = async (
  bookId: string,
  versionId?: string,
  locale?: PathLocale,
) => {
  return contentCache.fetch(makeCacheKey(bookId, versionId, locale));
};
