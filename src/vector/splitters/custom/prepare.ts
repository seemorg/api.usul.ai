import { fetchBookContent } from '@/book-fetchers';
import { removeDiacritics } from '@/lib/diacritics';
import { stripHtml } from 'string-strip-html';
import { getPageChapters } from '../../chapters';
import { createPageToChapterIndex } from './metadata';
import { convertOpenitiToHtml } from '../../helpers';

type BookContent = NonNullable<Awaited<ReturnType<typeof fetchBookContent>>>;

const prepareText = (text: string) => {
  const result = stripHtml(removeDiacritics(text)).result;
  return result;
};

export const prepareBookForChunking = (book: BookContent) => {
  if (book.source === 'external') return null;

  if (book.source === 'turath') {
    return book.turathResponse.pages.map((page, idx) => {
      const text = prepareText(page.text);

      return {
        index: idx,
        page: page.page,
        volume: page.vol,
        chaptersIndices: getPageChapters(idx, book.turathResponse.headings),
        text,
      };
    });
  }

  const pageToChapterIndex = createPageToChapterIndex(book);
  return book.content.map((page, idx) => {
    const html = convertOpenitiToHtml(page.blocks);
    const preparedText = prepareText(html);

    return {
      index: idx,
      page: page.page,
      volume: page.volume,
      chaptersIndices: pageToChapterIndex[idx] ?? [],
      text: preparedText,
    };
  });
};
