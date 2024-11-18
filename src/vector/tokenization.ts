import { fetchBookContent } from '@/book-fetchers';
import { removeDiacritics } from '@/lib/diacritics';
import { stripHtml } from 'string-strip-html';
import { get_encoding } from 'tiktoken';
import { getPageChapters } from './chapters';
import { createPageToChapterIndex } from './metadata';
import { convertOpenitiToHtml, splitTextIntoSentences } from './helpers';

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
        page: page.page,
        volume: page.vol,
        chaptersIndices: getPageChapters(idx, book.turathResponse.headings),
        formattedText: page.text,
        plainText: preparedText,
        // tokenizedText: textTokens,
      };
    });
  }

  const pageToChapterIndex = createPageToChapterIndex(book);
  return book.content.map((page, idx) => {
    const html = convertOpenitiToHtml(page.blocks);
    const preparedText = stripHtml(removeDiacritics(html)).result;
    // const textTokens = tokenize(preparedText);

    return {
      page: page.page,
      volume: page.volume,
      formattedText: html,
      plainText: preparedText,
      chaptersIndices: pageToChapterIndex[idx] ?? [],
      // tokenizedText: textTokens,
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

  for (let i = 0; i < level1ChaptersIndices.length; i++) {
    const pages = pagesByChapter[i];
    // const chapterIdx = level1ChaptersIndices[i];
    // const chapter = chapters[chapterIdx];

    const sentences: Chunk[] = [];

    pages.forEach((page, idx) => {
      // Split into sentences
      const formattedSentences = splitTextIntoSentences(page.formattedText);
      const plainSentences = splitTextIntoSentences(page.plainText);

      // Ensure that the sentences are aligned
      if (formattedSentences.length !== plainSentences.length) {
        // Handle misalignment
        console.warn(
          `Mismatch in sentences on page ${page.volume ?? '-'} / ${page.page}`,
        );
        // Proceed with the minimum length
        const minLength = Math.min(formattedSentences.length, plainSentences.length);
        formattedSentences.splice(minLength);
        plainSentences.splice(minLength);
      }

      // Collect sentences with their metadata
      const pagesRef = [
        { index: idx, page: String(page.page), volume: String(page.volume) },
      ];
      for (let i = 0; i < plainSentences.length; i++) {
        sentences.push({
          metadata: {
            chapterIndices: page.chaptersIndices,
            pages: pagesRef,
          },
          plainText: plainSentences[i],
          formattedText: formattedSentences[i],
        });
      }
    });

    let chunkPlainText = '';
    let chunkFormattedText = '';
    let chunkTokens: number[] = [];
    let chunkPageIndices = new Set<number>();
    let chunkChapterIndices = new Set<number>();
    // Additional metadata can be accumulated similarly

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const sentenceTokens = tokenize(sentence.plainText);

      // Check if adding this sentence exceeds the token limit
      if (chunkTokens.length + sentenceTokens.length > CHUNK_SIZE) {
        // Save the current chunk
        if (chunkTokens.length > 0) {
          const chunk: Chunk = {
            plainText: chunkPlainText.trim(),
            formattedText: chunkFormattedText.trim(),
            metadata: {
              pages: getPagesInfo(Array.from(chunkPageIndices)),
              chapterIndices: Array.from(chunkChapterIndices),
              // Include any additional merged metadata here
            },
          };
          chunks.push(chunk);

          // Reset the chunk variables
          chunkPlainText = '';
          chunkFormattedText = '';
          chunkTokens = [];
          chunkPageIndices.clear();
          chunkChapterIndices.clear();

          // Implement overlap if needed
          if (OVERLAP_SIZE > 0 && i >= OVERLAP_SIZE) {
            const overlapStartIndex = i - OVERLAP_SIZE;
            for (let j = overlapStartIndex; j < i; j++) {
              const overlapSentence = sentences[j];
              chunkPlainText += overlapSentence.plainText + ' ';
              chunkFormattedText += overlapSentence.formattedText + ' ';
              const overlapTokens = tokenize(overlapSentence.plainText);
              chunkTokens.push(...overlapTokens);
              overlapSentence.metadata.pages.forEach(p => chunkPageIndices.add(p.index));
              overlapSentence.metadata.chapterIndices.forEach(cIdx =>
                chunkChapterIndices.add(cIdx),
              );
              // Merge any additional metadata if needed
            }
          }
        }
      }

      // Add the sentence to the chunk
      chunkPlainText += sentence.plainText + ' ';
      chunkFormattedText += sentence.formattedText + ' ';
      chunkTokens.push(...sentenceTokens);
      sentence.metadata.pages.forEach(p => chunkPageIndices.add(p.index));
      sentence.metadata.chapterIndices.forEach(cIdx => chunkChapterIndices.add(cIdx));

      // Merge any additional metadata if needed
    }

    // Save any remaining chunk
    if (chunkTokens.length > 0) {
      const chunk: Chunk = {
        plainText: chunkPlainText.trim(),
        formattedText: chunkFormattedText.trim(),
        metadata: {
          pages: getPagesInfo(Array.from(chunkPageIndices)),
          chapterIndices: Array.from(chunkChapterIndices),
          // Include any additional merged metadata here
        },
      };
      chunks.push(chunk);
    }
  }

  return chunks;
};
