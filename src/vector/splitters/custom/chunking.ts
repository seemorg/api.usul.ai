import { TurathBookResponse } from '@/book-fetchers/turath';
import { prepareBookForChunking } from './prepare';
import { detokenize, tokenize } from './tokenization';
import { ParseResult } from '@openiti/markdown-parser';
import { deduplicateArray, splitTextIntoSentences } from '@/vector/helpers';

export const CHUNK_SIZE = 512;
export const OVERLAP_SIZE = 48;
export const MAX_CHUNK_SIZE = 1024;

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
type Chapters = TurathBookResponse['headings'] | ParseResult['chapters'];

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

  // console.log(level1ChaptersIndices.map(idx => chapters[idx].title));
  // console.log(
  //   pagesByChapter[pagesByChapter.length - 1][
  //     pagesByChapter[pagesByChapter.length - 1].length - 1
  //   ],
  // );

  const chunks: Chunk[] = [];

  for (let i = 0; i < pagesByChapter.length; i++) {
    const chapterPages = pagesByChapter[i].sort((a, b) => a.index - b.index);

    // Collect all tokens and create a token-to-page map
    // const allTokens: number[] = [];
    // const tokenPageMap: number[] = []; // Maps token index to page index

    let allText = '';
    let positionToPageIndex: { start: number; end: number; pageIndex: number }[] = [];

    chapterPages.forEach(page => {
      allText += page.text + ' ';
      positionToPageIndex.push({
        start: allText.length - page.text.length + 1,
        end: allText.length,
        pageIndex: page.index,
      });
    });

    const sentences = splitTextIntoSentences(allText);
    const sentenceIndexToMetadata: Record<number, { pageIndices: number[] }> = {};

    const addChunk = (text: string, sentenceIndices: number[]) => {
      const pageIndices = deduplicateArray(
        sentenceIndices.flatMap(idx => sentenceIndexToMetadata[idx].pageIndices),
      );

      chunks.push({
        text,
        metadata: {
          chapterIndices: deduplicateArray(
            pageIndices.flatMap(idx => pages[idx].chaptersIndices),
          ),
          pages: getPagesInfo(pageIndices),
        },
      });
    };

    let sentenceStart = 0;
    sentences.forEach((sentence, idx) => {
      const sentenceEnd = sentenceStart + sentence.length;
      sentenceIndexToMetadata[idx] = {
        pageIndices: positionToPageIndex
          .filter(pos => pos.start <= sentenceEnd && pos.end >= sentenceStart)
          .map(pos => pos.pageIndex),
      };

      sentenceStart = sentenceEnd;
    });

    let currentChunkTokens: number[] = [];
    const sentenceIndices = new Set<number>();

    for (const [sentenceIdx, sentence] of sentences.entries()) {
      const sentenceTokens = Array.from(tokenize(sentence));

      // If adding this sentence would exceed MAX_CHUNK_SIZE, create a new chunk
      if (currentChunkTokens.length + sentenceTokens.length > MAX_CHUNK_SIZE) {
        if (currentChunkTokens.length > 0) {
          const chunkText = detokenize(new Uint32Array(currentChunkTokens));

          addChunk(chunkText, Array.from(sentenceIndices));
          sentenceIndices.clear();

          // Start new chunk with overlap
          const overlapTokens = currentChunkTokens.slice(-OVERLAP_SIZE);
          currentChunkTokens = [...overlapTokens];
        }
      }

      // If current sentence alone exceeds MAX_CHUNK_SIZE, split it
      if (sentenceTokens.length > MAX_CHUNK_SIZE) {
        for (let j = 0; j < sentenceTokens.length; j += CHUNK_SIZE - OVERLAP_SIZE) {
          const chunkTokens = sentenceTokens.slice(j, j + CHUNK_SIZE);
          const chunkText = detokenize(new Uint32Array(chunkTokens));

          sentenceIndices.add(sentenceIdx);
          addChunk(chunkText, Array.from(sentenceIndices));
          sentenceIndices.clear();
        }
        currentChunkTokens = [];
      } else {
        // Add sentence to current chunk
        currentChunkTokens.push(...sentenceTokens);
        sentenceIndices.add(sentenceIdx);

        // If we've exceeded CHUNK_SIZE (but not MAX_CHUNK_SIZE), create a new chunk
        if (currentChunkTokens.length >= CHUNK_SIZE) {
          const chunkText = detokenize(new Uint32Array(currentChunkTokens));

          addChunk(chunkText, Array.from(sentenceIndices));
          sentenceIndices.clear();

          // Start new chunk with overlap
          const overlapTokens = currentChunkTokens.slice(-OVERLAP_SIZE);
          currentChunkTokens = [...overlapTokens];
        }
      }
    }

    // Add any remaining tokens as the final chunk
    if (currentChunkTokens.length > 0) {
      const chunkText = detokenize(new Uint32Array(currentChunkTokens));
      addChunk(chunkText, Array.from(sentenceIndices));
      sentenceIndices.clear();
    }
  }

  return chunks;
};
