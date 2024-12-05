import { Document, Metadata, TextNode } from 'llamaindex';

import { attachMetadataToNodes, preparePages } from './metadata';
import { getBookById, getBookBySlug } from '@/services/book';
import { fetchBookContent } from '@/book-fetchers';

import { JOIN_PAGES_DELIMITER } from './utils';
import { chunk, sleep } from '@/lib/utils';
import { splitter } from './splitter';
import { embeddings } from '@/vector/openai';
import { BookChunk, searchClient } from '@/vector/vector-store';

const MAX_RETRIES = 3;

const makeChunkId = (
  bookId: string,
  versionSource: string,
  versionValue: string,
  idx: number,
) =>
  Buffer.from(`${bookId}:${versionSource}:${versionValue}:${idx}`).toString('base64url');

const retryWithDelay = async <T>(
  fn: () => Promise<T>,
  delayInSeconds: number,
  shouldRetry?: (e: any) => boolean,
): Promise<{ result: T; error: null } | { result: null; error: Error }> => {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return { result: await fn(), error: null };
    } catch (e: any) {
      // if it's the last retry or the error is not retryable, throw
      if (i === MAX_RETRIES - 1 || (shouldRetry && !shouldRetry(e))) {
        return { result: null, error: e };
      }

      await sleep(delayInSeconds * 1000);
    }
  }

  return { result: null, error: new Error('Exceeded max retries') };
};

export async function indexBook(
  params: ({ id: string } | { slug: string }) & {
    versionId: string;
  },
) {
  const book = await ('id' in params
    ? getBookById(params.id)
    : getBookBySlug(params.slug));

  if (!book) {
    return { status: 'not-found' };
  }

  const versionToIndex = book.versions.find(v => v.value === params.versionId);
  if (!versionToIndex) {
    return { status: 'not-found' };
  }

  const bookContent = await fetchBookContent(
    {
      id: book.id,
      author: { id: book.author!.id },
      versions: book.versions,
    },
    versionToIndex.value,
  );
  if (!bookContent || bookContent.source === 'external') {
    return { status: 'skipped' };
  }

  console.log(`preparing pages for: ${versionToIndex.source}:${versionToIndex.value}`);

  let chapters;
  let pages;
  let preparedPages;
  if (bookContent.source === 'turath') {
    chapters = bookContent.turathResponse.headings;
    pages = bookContent.turathResponse.pages;
    preparedPages = preparePages(pages, chapters);
  } else {
    // version.source === 'openiti'
    chapters = bookContent.chapters;
    pages = bookContent.content;
    preparedPages = preparePages(pages, chapters);
  }

  console.log('splitting into chapters');
  const level1ChaptersIndices = chapters.reduce((acc, heading, idx) => {
    if (heading.level === 1) {
      acc.push(idx);
    }
    return acc;
  }, [] as number[]);

  const pagesByChapter = level1ChaptersIndices.map(idx =>
    preparedPages.filter(page => page.chaptersIndices.includes(idx)),
  );

  const nodes: TextNode<Metadata>[] = [];
  let chapterIdx = 1;
  for (const chapterPages of pagesByChapter) {
    console.log(`splitting chapter ${chapterIdx++} / ${pagesByChapter.length}`);

    const concatenatedContent = chapterPages.map(p => p.text).join(JOIN_PAGES_DELIMITER);

    const doc = new Document({
      metadata: {},
      text: concatenatedContent,
    });

    const chapterNodes = splitter.getNodesFromDocuments([doc]);

    try {
      attachMetadataToNodes(chapterNodes, {
        id: book.id,
        pages: chapterPages,
      });
    } catch (e) {
      return { status: 'error', reason: 'Failed to attach metadata', error: e };
    }

    nodes.push(...chapterNodes);
  }

  const batches = chunk(nodes, 30);
  let i = 0;

  const versionSource = versionToIndex.source;
  const versionValue = versionToIndex.value;

  let activeBatch = 0;
  for (const batch of batches) {
    console.log(`Embedding batch ${++activeBatch} / ${batches.length}`);

    // we first embed
    const embeddingsResult = await Promise.all(
      batch.map(async (node, idx): Promise<BookChunk> => {
        const embedding = await retryWithDelay(
          async () => {
            const response = await embeddings.create({
              input: node.text,
              model: 'text-embedding-3-small',
            });
            return response.data[0].embedding;
          },
          10,
          // retry if the error is not about the context length
          e =>
            !e.message?.includes(
              "400 This model's maximum context length is 8192 tokens",
            ),
        );

        if (embedding.error) {
          throw embedding.error;
        }

        const nodeIdx = i * batches.length + idx;

        const prevId =
          nodeIdx > 0
            ? makeChunkId(book.id, versionSource, versionValue, nodeIdx - 1)
            : undefined;
        const nextId =
          nodeIdx < nodes.length - 1
            ? makeChunkId(book.id, versionSource, versionValue, nodeIdx + 1)
            : undefined;

        return {
          id: makeChunkId(book.id, versionSource, versionValue, nodeIdx),
          book_version_id: `${versionSource}:${versionValue}`,
          prev_id: prevId,
          next_id: nextId,
          chunk_embedding: embedding.result,
          chunk_content: node.text,
          book_id: book.id,
          chapters: node.metadata.chaptersIndices,
          pages: node.metadata.pages.map((p: any) => ({
            index: p.index,
            page: p.page ? String(p.page) : undefined,
            volume: p.volume ? String(p.volume) : undefined,
          })),
        };
      }),
    );

    await searchClient.mergeOrUploadDocuments(embeddingsResult);

    i++;
  }

  return { status: 'success', versionId: versionToIndex.value };
}
