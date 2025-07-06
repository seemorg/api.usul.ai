import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { createDataStream, DataStreamWriter, StreamTextResult, ToolSet } from 'ai';
import { routeQuery } from '@/chat/route-query';
import { BookDetailsResponse, getBookDetails } from '../book/details';
import { answerMultiBookAuthorQuery } from '@/chat/author-chat';
import { answerMultiBookQuery } from '@/chat/book-chat';
import { condenseMessageHistory } from '@/chat/condense-chat';
import { AzureSearchResult, searchBook } from '@/book-search/search';
import { answerMultiBookRagQuery } from '@/chat/rag';
import { dataStreamToResponse } from '@/lib/stream';
import { messagesSchema } from '@/validators/chat';
import { getBookById, getBooksByAuthorId, getBooksByGenreId } from '@/services/book';
import { BookDto } from '@/dto/book.dto';
import { localeSchema } from '@/validators/locale';
import { generateQueries } from '@/chat/generate-queries';
import { rerankChunks } from '@/lib/cohere';

const multiChatRoutes = new Hono();

const writeSources = (
  writer: DataStreamWriter,
  sources: AzureSearchResult[],
  books: BookDto[],
) => {
  writer.writeMessageAnnotation({
    type: 'SOURCES',
    value: sources.map(source => {
      const book = books.find(b => b.id === source.node.metadata.bookId);

      return {
        score: source.score,
        text: source.node.text,
        metadata: source.node.metadata,
        book: book
          ? {
              primaryName: book.primaryName!,
              slug: book.slug,
            }
          : null,
      };
    }),
  });
};

multiChatRoutes.post(
  '/multi',
  zValidator(
    'query',
    z.object({
      locale: localeSchema,
    }),
  ),
  zValidator(
    'json',
    z.object({
      isRetry: z.boolean().optional(),
      bookIds: z.array(z.string()).optional().default([]),
      authorIds: z.array(z.string()).optional().default([]),
      genreIds: z.array(z.string()).optional().default([]),
      messages: messagesSchema,
    }),
  ),
  async c => {
    const body = c.req.valid('json');
    const { locale } = c.req.valid('query');
    const chatId = uuidv4();
    const sessionId = uuidv4();

    const lastMessage = body.messages[body.messages.length - 1].content;
    const messages = body.messages.slice(0, body.messages.length - 1);
    // get last 6 messages
    const chatHistory = messages.slice(-6);

    const resolvedBookIds = new Set<string>();
    if (body.bookIds.length > 0) {
      body.bookIds.forEach(bookId => resolvedBookIds.add(bookId));
    }

    if (body.authorIds.length > 0) {
      body.authorIds.forEach(authorId => {
        const books = getBooksByAuthorId(authorId, locale);
        books.forEach(book => resolvedBookIds.add(book.id));
      });
    }

    if (body.genreIds.length > 0) {
      body.genreIds.forEach(genreId => {
        const books = getBooksByGenreId(genreId, locale);
        books.forEach(book => resolvedBookIds.add(book.id));
      });
    }

    const books = [...resolvedBookIds]
      .map(id => getBookById(id, locale))
      .filter(Boolean) as BookDto[];

    const dataStream = createDataStream({
      execute: async writer => {
        writer.writeMessageAnnotation({ type: 'CHAT_ID', value: chatId });
        writer.writeMessageAnnotation({ type: 'STATUS', value: 'generating-queries' });

        const queries = (
          await generateQueries({ chatHistory: body.messages, sessionId })
        ).map(q => q.query);

        writer.writeMessageAnnotation({
          type: 'STATUS',
          value: 'searching',
          queries,
        });

        // search the queries in parallel
        const searchResults = (
          await Promise.all(
            [...queries, lastMessage].map(async query => {
              const result = await searchBook({
                query,
                books:
                  books.length > 0 ? books.map(book => ({ id: book.id })) : undefined,
                type: 'vector',
                limit: 20,
                rerank: false,
              });
              return result.results;
            }),
          )
        ).flat();

        const idToSource: Record<string, AzureSearchResult> = {};
        for (const result of searchResults) {
          idToSource[result.node.id] = result;
        }

        // pass de-duplicated sources to rerank
        const sources = await rerankChunks(lastMessage, Object.values(idToSource), {
          topK: 20,
        });

        writer.writeMessageAnnotation({
          type: 'STATUS',
          value: 'generating-response',
        });

        const result = await answerMultiBookRagQuery({
          history: chatHistory,
          query: lastMessage, // use last message and not ragQuery to preserve context
          sources,
          isRetry: body.isRetry,
          traceId: chatId,
          sessionId,
        });
        result.mergeIntoDataStream(writer);

        const sourcesBooks =
          books.length > 0
            ? books
            : (sources
                .map(source => getBookById(source.node.metadata.bookId, locale))
                .filter(Boolean) as BookDto[]);

        writeSources(writer, sources, sourcesBooks);
      },
      onError: error => {
        console.log(error);
        return error instanceof Error ? error.message : String(error);
      },
    });

    return dataStreamToResponse(c, dataStream);
  },
);

export default multiChatRoutes;
