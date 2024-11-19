import { TurathBookResponse } from '@/book-fetchers/turath';
import { deduplicateArray } from './helpers';
import { prepareBookForChunking } from './prepare';
import { detokenize, tokenize } from './tokenization';
import { ParseResult } from '@openiti/markdown-parser';

export const CHUNK_SIZE = 512;
export const OVERLAP_SIZE = 24;

interface Chunk {
  text: string;
  metadata: {
    chapterIndices: number[];
    pages: {
      index: number;
      page: string;
      volume?: string;
    }[];
  };
}

type BookContent = ReturnType<typeof prepareBookForChunking>;
type Chapters =
  | TurathBookResponse['turathResponse']['headings']
  | ParseResult['chapters'];

export const splitBookIntoChunks = (pages: BookContent, chapters: Chapters) => {
  if (!pages) return [];

  const getPagesInfo = (pageIndices: number[]) =>
    pageIndices.map(idx => ({
      index: idx,
      page: String(pages[idx].page),
      volume: pages[idx].volume ? String(pages[idx].volume) : undefined,
    }));

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
      allTokens.push(...tokenize(page.text));
      for (let i = 0; i < page.text.length; i++) {
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
        text: chunkText,
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
