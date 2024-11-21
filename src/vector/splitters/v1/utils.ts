import { FetchBookResponseOfType } from '@/book-fetchers';

type BookHeadings = FetchBookResponseOfType<'turath'>['turathResponse']['headings'];
type BookPages = FetchBookResponseOfType<'turath'>['turathResponse']['pages'];

export const createPageToChapterIndex = (pageHeadings: BookHeadings) => {
  const index = pageHeadings.reduce((acc, curr, idx) => {
    if (!acc[curr.pageIndex!]) acc[curr.pageIndex!] = [];
    acc[curr.pageIndex!].push(idx);
    return acc;
  }, {} as Record<number, number[]>);

  return index;
};

export const JOIN_PAGES_DELIMITER = '';
export const getBookPositions = (pages: { text: string }[]) => {
  // Step 3: Create a list of positions for each page's content in the concatenated string
  const value = pages.reduce(
    (acc, item, idx) => {
      const start =
        acc.length > 0 ? acc[acc.length - 1]!.end + JOIN_PAGES_DELIMITER.length : 0;
      const end = start + item.text.length;
      acc.push({ idx, start, end });
      return acc;
    },
    [] as {
      idx: number;
      start: number;
      end: number;
    }[],
  );

  return value;
};

export const getChapterIndices = (
  pageIndex: number,
  pageIndexToChapterIndex: ReturnType<typeof createPageToChapterIndex>,
) => {
  // book.indexes.pages_headings is Record<string, number[]> (index of page + 1 -> index of header + 1)
  let chaptersIndices: number[] = [];
  for (const [page, indices] of Object.entries(pageIndexToChapterIndex)) {
    if (Number(page) <= pageIndex) {
      chaptersIndices = indices;
    } else {
      break;
    }
  }

  return chaptersIndices;
};
