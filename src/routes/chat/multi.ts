import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { createDataStream } from 'ai';

import { searchQueriesInParallel } from '@/book-search/search';
import { answerMultiBookRagQuery } from '@/chat/rag';
import { dataStreamToResponse } from '@/lib/stream';
import { messagesSchema } from '@/validators/chat';
import { getBookById, getBooksByAuthorId, getBooksByGenreId } from '@/services/book';
import { BookDto } from '@/dto/book.dto';
import { localeSchema } from '@/validators/locale';
import { generateQueries } from '@/chat/generate-queries';
import { rerankChunks } from '@/lib/cohere';
import { writeSourcesToStream } from '@/chat/utils';
import { condenseMessageHistory } from '@/chat/condense-chat';
import { detectLanguage } from '@/chat/detect-language';

const multiChatRoutes = new Hono();

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
      chatId: z.string().optional(),
    }),
  ),
  async c => {
    const body = c.req.valid('json');
    const { locale } = c.req.valid('query');

    const traceId = uuidv4();
    const sessionId = body.chatId ?? uuidv4();

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
        // pass traceId to frontend to be able to give feedback (thumbs up/down)
        writer.writeMessageAnnotation({ type: 'CHAT_ID', value: traceId });
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
        const [searchResults, queryLanguage, rerankQuery] = await Promise.all([
          searchQueriesInParallel([...queries, lastMessage], {
            books: books.length > 0 ? books.map(book => ({ id: book.id })) : undefined,
          }),
          detectLanguage({ query: lastMessage, sessionId }),
          (async () => {
            if (chatHistory.length === 0) return lastMessage;

            return condenseMessageHistory({
              chatHistory,
              query: lastMessage,
              isRetry: body.isRetry,
              sessionId,
            });
          })(),
        ]);

        // pass de-duplicated sources to rerank
        const sources = await rerankChunks(rerankQuery, searchResults, {
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
          traceId,
          sessionId,
          language: queryLanguage,
        });
        result.mergeIntoDataStream(writer);

        // if there are books specified in filters, use them to get book details, otherwise use sources to get book details
        const sourcesBooks =
          books.length > 0
            ? books
            : ([...new Set(sources.map(source => source.node.metadata.bookId))]
                .map(bookId => getBookById(bookId, locale))
                .filter(Boolean) as BookDto[]);

        writeSourcesToStream(writer, sources, sourcesBooks);
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
