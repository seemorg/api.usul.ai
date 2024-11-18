import { fetchBookContent } from '@/book-fetchers';
import { removeDiacritics } from '@/lib/diacritics';
import { stripHtml } from 'string-strip-html';
import { get_encoding } from 'tiktoken';
import { getPageChapters } from './chapters';
import { createPageToChapterIndex } from './metadata';
import { convertOpenitiToHtml, deduplicateArray } from './helpers';

/**
 * Steps for tokenization:
 * 1. Loop over all pages, and tokenize their content
 * 2. Group pages by chapters (level == 1):
 *  - for each page in the chapter, make a map of token start and end indices to it's index in the big pages array (to get metadata)
 * 3. Loop over chapters, split tokens into chunks with overlap, and map each chunk to the original pages it came from
 */

// cl100k_base is the encoding for text-embedding-3-large (our model)
const encoder = get_encoding('cl100k_base');
const textDecoder = new TextDecoder();

export function tokenize(text: string): Uint32Array {
  return encoder.encode(text);
}

export function detokenize(tokens: Uint32Array): string {
  const result = encoder.decode(tokens);
  return textDecoder.decode(result);
}

export const CHUNK_SIZE = 512;
export const OVERLAP_SIZE = 24;

type BookContent = NonNullable<Awaited<ReturnType<typeof fetchBookContent>>>;

export const prepareBook = (book: BookContent) => {
  if (book.source === 'external') return null;

  if (book.source === 'turath') {
    return book.turathResponse.pages.map((page, idx) => {
      const preparedText = stripHtml(removeDiacritics(page.text)).result;
      // const textTokens = tokenize(preparedText);

      return {
        index: idx,
        page: page.page,
        volume: page.vol,
        chaptersIndices: getPageChapters(idx, book.turathResponse.headings),
        formattedText: page.text,
        plainText: preparedText,
      };
    });
  }

  const pageToChapterIndex = createPageToChapterIndex(book);
  return book.content.map((page, idx) => {
    const html = convertOpenitiToHtml(page.blocks);
    const preparedText = stripHtml(removeDiacritics(html)).result;

    return {
      index: idx,
      page: page.page,
      volume: page.volume,
      formattedText: html,
      plainText: preparedText,
      chaptersIndices: pageToChapterIndex[idx] ?? [],
    };
  });
};

interface Chunk {
  plainText: string;
  formattedText: string;
  // text: string;
  metadata: {
    chapterIndices: number[];
    pages: {
      index: number;
      page: string;
      volume?: string;
    }[];
  };
}

export const splitBookIntoChunks = (book: BookContent) => {
  const pages = prepareBook(book);
  if (!pages || book.source === 'external') return [];

  const getPagesInfo = (pageIndices: number[]) =>
    pageIndices.map(idx => ({
      index: idx,
      page: String(pages[idx].page),
      volume: pages[idx].volume ? String(pages[idx].volume) : undefined,
    }));

  const chapters =
    book.source === 'turath' ? book.turathResponse.headings : book.chapters;

  const level1ChaptersIndices = chapters.reduce((acc, heading, idx) => {
    if (heading.level === 1) {
      acc.push(idx);
    }
    return acc;
  }, [] as number[]);

  const pagesByChapter = level1ChaptersIndices.map(idx =>
    pages.filter(page => page.chaptersIndices.includes(idx)),
  );

  const chunks: Chunk[] = [];

  for (let i = 0; i < pagesByChapter.length; i++) {
    const chapterPages = pagesByChapter[i];

    // Collect all tokens and create a token-to-page map
    const allTokens: number[] = [];
    const tokenPageMap: number[] = []; // Maps token index to page index
    chapterPages.forEach(page => {
      allTokens.push(...tokenize(page.plainText));
      for (let i = 0; i < page.plainText.length; i++) {
        tokenPageMap.push(page.index);
      }
    });

    // Split tokens into chunks with overlap
    for (let i = 0; i < allTokens.length; i += CHUNK_SIZE - OVERLAP_SIZE) {
      const chunkTokens = allTokens.slice(i, i + CHUNK_SIZE);
      const chunkText = detokenize(new Uint32Array(chunkTokens));

      // Map chunk token indices to original token indices
      const chunkTokenIndices = Array.from(
        { length: chunkTokens.length },
        (_, idx) => i + idx,
      );

      // Determine the page numbers for this chunk
      const uniquePageIndices = deduplicateArray(
        chunkTokenIndices.map(tokenIdx => tokenPageMap[tokenIdx]),
      );

      const chapterIndices = deduplicateArray(
        uniquePageIndices.flatMap(idx => pages[idx].chaptersIndices),
      );

      const chunk: Chunk = {
        plainText: chunkText,
        formattedText: '',
        metadata: {
          chapterIndices,
          pages: getPagesInfo(uniquePageIndices),
        },
      };

      chunks.push(chunk);
    }
  }

  return chunks;
};
