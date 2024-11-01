import {
  fetchTurathBookById,
  getTurathPdfDetails,
  getTurathPublicationDetails,
} from '@/lib/turath';
import { TurathApiBookResponse } from '@/types/turath';
import { stripHtml } from 'string-strip-html';

export const fetchTurathBook = async (id: string) => {
  const res = await fetchTurathBookById(id);

  const headerPageToVolumeAndPage = Object.entries(res.indexes.print_pg_to_pg).reduce(
    (acc, curr) => {
      const [bookPage, headerPage] = curr;
      const [vol, page] = bookPage.split(',');

      if (!vol || !page) return acc;

      acc[headerPage] = { vol, page: Number(page) };

      return acc;
    },
    {} as Record<number, { vol: string; page: number }>,
  );

  let lastPage: number;
  const headings = res.indexes.headings.map(h => {
    const headerPage = h.page;

    // try to directly get the page from the headerPageToVolumeAndPage
    let page = headerPageToVolumeAndPage[headerPage];

    // if not found, iterate backwards and find the first that's smaller than the current headerPage
    if (!page) {
      if (lastPage && headerPage > lastPage) {
        // Use the last known page if the current header page is greater
        page = headerPageToVolumeAndPage[lastPage];
      } else {
        // Iterate backwards to find the closest previous page
        for (let i = headerPage - 1; i > 0; i--) {
          page = headerPageToVolumeAndPage[i];
          if (page) {
            lastPage = i;
            break;
          }
        }
      }
    } else {
      lastPage = headerPage;
    }

    return {
      ...h,
      page,
    };
  });

  const mergedPages: TurathApiBookResponse['pages'] = [];
  const oldIndexToNewIndex: Record<number, number> = {};
  const pageNumberWithVolumeToIndex: Record<string, number> = {};

  for (let i = 0; i < res.pages.length; i++) {
    const page = res.pages[i]!;
    page.text = stripHtml(page.text, { onlyStripTags: ['a'] }).result;

    let didMerge = false;
    if (mergedPages.length > 0) {
      const lastPage = mergedPages[mergedPages.length - 1]!;
      if (lastPage.page === page.page && lastPage.vol === page.vol) {
        lastPage.text += lastPage.text.endsWith('</span>.')
          ? page.text
          : `<br>${page.text}`;
        didMerge = true;
      }
    }

    if (!didMerge) {
      mergedPages.push(page);
    }

    oldIndexToNewIndex[i] = mergedPages.length - 1;
    pageNumberWithVolumeToIndex[`${page.vol}-${page.page}`] = mergedPages.length - 1;
  }

  Object.entries(res.indexes.page_headings).forEach(curr => {
    const [pageIndex, headingIndices] = curr;
    headingIndices.forEach(i => {
      const heading = headings[i - 1];
      if (heading) {
        heading.pageIndex = oldIndexToNewIndex[Number(pageIndex) - 1] ?? -1;
      }
    });
  });

  const publicationDetails = getTurathPublicationDetails(res.meta.info);

  // fetch from turath
  return {
    turathResponse: {
      pdf: getTurathPdfDetails(res.meta.pdf_links),
      headings,
      pages: mergedPages,
      publicationDetails,
    },
    // chapterIndexToPageIndex,
    // pageNumberWithVolumeToIndex,
  };
};

export type TurathBookResponse = {
  source: 'turath';
  versionId: string;
} & Awaited<ReturnType<typeof fetchTurathBook>>;
