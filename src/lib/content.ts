import { LRUCache } from 'lru-cache';
import type { PathLocale } from '@/lib/locale';
import { fetchBookContent, type FetchBookResponse } from '@/book-fetchers';
import { getBookBySlug } from '@/services/book';

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

export const getCachedBookContent = async (
  bookSlug: string,
  versionId?: string,
  locale?: PathLocale,
) => {
  return contentCache.fetch(makeCacheKey(bookSlug, versionId, locale));
};
