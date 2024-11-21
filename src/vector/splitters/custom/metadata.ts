import type { ContentItem, ParseResult } from '@openiti/markdown-parser';

const createPageNumberToIndex = (pages: ContentItem[]) => {
  return pages.reduce((acc, page, idx) => {
    acc[`${page.volume}-${page.page}`] = idx;
    return acc;
  }, {} as Record<string, number>);
};

export const createPageToChapterIndex = (result: ParseResult) => {
  const pageNumberAndVolToIndex = createPageNumberToIndex(result.content);

  // map chapter's page number to index
  // group them by page index
  const index = Object.entries(pageNumberAndVolToIndex).reduce((acc, curr) => {
    const [pageNumberAndVol, pageIndex] = curr;
    const [vol, pageNumber] = pageNumberAndVol.split('-').map(Number);

    const pageChaptersIndices: number[] = [];
    result.chapters.forEach((c, idx) => {
      if (c.volume === vol && c.page === pageNumber) {
        pageChaptersIndices.push(idx);
      }
    });

    acc[pageIndex] = pageChaptersIndices;

    return acc;
  }, {} as Record<number, number[]>);

  return index;
};
