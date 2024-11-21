import type { TextNode } from 'llamaindex';

import { getBookPositions } from './utils';
import { FetchBookResponseOfType } from '@/book-fetchers';
import { stripHtml } from 'string-strip-html';
import { removeDiacritics } from '@/lib/diacritics';
import { splitter } from './splitter';
import { getPageChapters } from '@/vector/chapters';
import { convertOpenitiToHtml } from '@/vector/helpers';

const trimSpacesAfterSentenceEndings = (text: string): string => {
  // Regex to trim spaces after sentence-ending punctuation
  const sentenceEndPattern = /([.?!…])\s+/g;

  // Regex to trim spaces inside curly braces, brackets, and parentheses
  const bracketsPattern = /([{}[\]()])\s+|\s+([{}[\]()])/g;

  // Regex to trim spaces inside single and double quotes
  const quotesPattern = /(["'])\s+|\s+(["'])/g;

  // Apply all patterns
  return text
    .replace(sentenceEndPattern, '$1') // Remove spaces after sentence-ending punctuation
    .replace(bracketsPattern, '$1$2') // Remove spaces around brackets
    .replace(quotesPattern, '$1$2'); // Remove spaces around quotes
};

type Pages =
  | Pick<FetchBookResponseOfType<'turath'>['turathResponse'], 'pages'>['pages']
  | FetchBookResponseOfType<'openiti'>['content'];

type Chapters =
  | Pick<FetchBookResponseOfType<'turath'>['turathResponse'], 'headings'>['headings']
  | FetchBookResponseOfType<'openiti'>['chapters'];

export const preparePages = (pages: Pages, headings: Chapters) => {
  return pages.map((p, idx) => {
    const isTurath = 'text' in p;
    const pageText = stripHtml(
      removeDiacritics(isTurath ? p.text : convertOpenitiToHtml(p.blocks)),
    ).result;

    const text = trimSpacesAfterSentenceEndings(
      splitter
        .splitText(pageText)
        .map(t => t.trim())
        .join(''),
    );

    return {
      index: idx,
      page: p.page,
      volume: isTurath ? p.vol : p.volume,
      text,
      chaptersIndices: getPageChapters(idx, headings),
    };
  });
};

type PreparePagesReturnType = ReturnType<typeof preparePages>;

export const attachMetadataToNodes = (
  nodes: TextNode[],
  book: {
    id: string;
    pages: PreparePagesReturnType;
  },
) => {
  let positions;

  let i = 0;
  for (const node of nodes) {
    i++;

    const matchedPageIndices = new Set<number>();

    if (node.endCharIdx === undefined || node.startCharIdx === undefined) {
      console.error(`[NODE ${i} - ${node.id_}] did not find start or end char idx`);
      throw new Error('Could not link metadata!');
      // let startIndex = 0;
      // // Iterate over each page's content to find overlaps
      // book.data.pages.forEach((page, idx) => {
      //   const pageContent = page.text;
      //   let index = pageContent.indexOf(node.text, startIndex);

      //   // Check if the chunk overlaps with the current page content
      //   while (index !== -1) {
      //     matchedPageIndices.add(idx);
      //     startIndex = index + node.text.length;
      //     index = pageContent.indexOf(node.text, startIndex);
      //   }
      // });
    } else {
      if (!positions) {
        positions = getBookPositions(book.pages);
      }

      positions
        .filter(pos => pos.start <= node.endCharIdx! && pos.end >= node.startCharIdx!)
        .forEach(p => {
          matchedPageIndices.add(p.idx);
        });
    }

    const matchedIndicesArray = Array.from(matchedPageIndices);
    if (matchedIndicesArray.length === 0) {
      console.error(`[NODE ${i} - ${node.id_}] Could not link metadata!`);
      throw new Error('Could not link metadata!');
    }

    const pageNumbers = [];
    const chaptersIndices = new Set<number>();

    for (const idx of matchedIndicesArray) {
      const page = book.pages[idx]!;
      pageNumbers.push({
        index: page.index,
        page: page.page,
        volume: page.volume,
      });

      page.chaptersIndices.forEach(idx => chaptersIndices.add(idx));
    }

    node.metadata.chaptersIndices = Array.from(chaptersIndices);
    node.metadata.pages = pageNumbers;
  }
};
