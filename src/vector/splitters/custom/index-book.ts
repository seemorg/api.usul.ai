import { fetchBookContent } from '@/book-fetchers';
import { getBookBySlug } from '@/services/book';
import { stripHtml } from 'string-strip-html';
import { removeDiacritics } from '@/lib/diacritics';
import { embeddings } from '@/vector/openai';
import { getPageChapters } from '@/vector/chapters';
import { searchClient } from '@/vector/vector-store';

const getPageId = (
  bookId: string,
  versionId: string,
  pageNumber: number,
  vol?: string,
  increment?: number,
) =>
  Buffer.from(
    `${bookId}:${versionId}_${vol ?? '-'}:${pageNumber}` +
      (increment ? `:${increment}` : ''),
  ).toString('base64url');

const chunk = <T>(arr: T[], size: number) => {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size),
  );
};

const locale = 'en';
const slug = 'sahih';
const versionId = '735';
const CHUNK_SIZE = 40;

const START_BATCH = 22;

const main = async () => {
  const book = await getBookBySlug(slug, locale);
  if (!book) {
    return;
  }

  const bookContent = await fetchBookContent(book, versionId);
  if (!bookContent) {
    return;
  }

  if (bookContent.source === 'turath') {
    const chapters = bookContent.headings;
    const batches = chunk(bookContent.pages, CHUNK_SIZE);

    let i = 0;
    for (const batch of batches) {
      console.log(`Processing batch ${i + 1} / ${batches.length}`);
      if (i < START_BATCH) {
        i++;
        continue;
      }

      const data = await Promise.all(
        batch.map(async (page, idx) => {
          const pageIndex = i * CHUNK_SIZE + idx;
          let embeddingData: number[] | null = null;
          let embeddingResults: number[][] = [];
          const textToEmbed = stripHtml(removeDiacritics(page.text)).result;

          try {
            const embedding = await embeddings.create({
              model: 'text-embedding-3-large',
              dimensions: 3072,
              input: textToEmbed,
            });
            embeddingData = embedding.data[0].embedding;
          } catch (e) {
            if (
              e instanceof Error &&
              e.message.includes("This model's maximum context length is 8192 tokens")
            ) {
              // divide to 2 parts
              const splits = textToEmbed.split('\n\n');

              const midpoint = Math.floor(splits.length / 2);
              const firstPart = splits.slice(0, midpoint).join('\n\n');
              const secondPart = splits.slice(midpoint).join('\n\n');

              const [embeddingOne, embeddingTwo] = await Promise.all([
                embeddings.create({
                  model: 'text-embedding-3-large',
                  dimensions: 3072,
                  input: firstPart,
                }),
                embeddings.create({
                  model: 'text-embedding-3-large',
                  dimensions: 3072,
                  input: secondPart,
                }),
              ]);

              embeddingResults = [
                embeddingOne.data[0].embedding,
                embeddingTwo.data[0].embedding,
              ];
            }
          }

          if (!embeddingData) {
            return embeddingResults.map((result, idx) => ({
              id: getPageId(book.id, versionId, page.page, page.vol, idx + 1),
              book_id: book.id,
              chunk_content: page.text,
              chunk_embedding: result,
              chapters: getPageChapters(pageIndex, chapters),
              pages: [{ index: pageIndex, page: page.page, volume: page.vol }],
            }));
          } else {
            return [
              {
                id: getPageId(book.id, versionId, page.page, page.vol),
                book_id: book.id,
                chunk_content: page.text,
                chunk_embedding: embeddingData,
                chapters: getPageChapters(pageIndex, chapters),
                pages: [{ index: pageIndex, page: page.page, volume: page.vol }],
              },
            ];
          }
        }),
      ).then(results => results.flat());

      // if (data.find(d => d === null)) {
      //   break;
      // }

      await searchClient.mergeOrUploadDocuments(data);
      i++;
    }
  }
};

main();
