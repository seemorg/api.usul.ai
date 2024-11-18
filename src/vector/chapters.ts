import { fetchBookContent } from '@/book-fetchers';

type Book = NonNullable<Awaited<ReturnType<typeof fetchBookContent>>>;
type Headings =
  | Extract<Book, { source: 'turath' }>['turathResponse']['headings']
  | (Extract<Book, { source: 'openiti' }>['chapters'][number] & { pageIndex?: number })[];

export const getPageChapters = (pageIdx: number, headings: Headings) => {
  let pageHeadings: number[] = [];

  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    if (heading.pageIndex !== undefined && heading.pageIndex > pageIdx) break;

    if (heading.level === 1) {
      pageHeadings = [i];
    } else {
      const lastIdx = pageHeadings[pageHeadings.length - 1];
      if (pageHeadings.length > 0 && headings[lastIdx].level >= heading.level) {
        // if the last heading is the same level, replace it with the current one
        pageHeadings[pageHeadings.length - 1] = i;
      } else {
        pageHeadings.push(i);
      }
    }
  }

  return pageHeadings;
};
