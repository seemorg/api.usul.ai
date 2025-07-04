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
import { getBookById } from '@/services/book';
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
      bookIds: z.array(z.string()).optional().default([]), // Limit to 10 books for performance
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

    const bookDetailsArray = (
      await Promise.all(
        body.bookIds.map(async bookId => {
          const details = await getBookDetails(bookId, locale).catch(() => null);
          if (!details || 'type' in details) return null;
          return details;
        }),
      )
    ).filter(Boolean) as BookDetailsResponse[];

    if (bookDetailsArray.length > 0) {
      let streamResult: StreamTextResult<ToolSet, never>;
      let sources: AzureSearchResult[] | null = null;

      const routerResult = await routeQuery(chatHistory, lastMessage, sessionId);

      if (routerResult === 'author') {
        streamResult = await answerMultiBookAuthorQuery({
          bookDetailsArray,
          history: chatHistory,
          query: lastMessage,
          traceId: chatId,
          sessionId,
        });
      } else if (routerResult === 'summary') {
        streamResult = await answerMultiBookQuery({
          bookDetailsArray,
          history: chatHistory,
          query: lastMessage,
          traceId: chatId,
          sessionId,
        });
      } else if (routerResult === 'content') {
        let ragQuery: string;
        // If there are no messages, don't condense the history
        if (chatHistory.length === 0) ragQuery = lastMessage;
        else {
          ragQuery = await condenseMessageHistory({
            chatHistory,
            query: lastMessage,
            isRetry: body.isRetry,
            sessionId,
          });
        }

        sources = await searchBook({
          books: bookDetailsArray.map(bookDetails => ({
            id: bookDetails.book.id,
          })),
          query: ragQuery,
          type: 'vector',
          limit: 50,
          rerank: true,
          rerankLimit: 15,
        }).then(r => r.results);

        streamResult = await answerMultiBookRagQuery({
          history: chatHistory,
          query: lastMessage, // use last message and not ragQuery to preserve context
          sources: sources!,
          isRetry: body.isRetry,
          traceId: chatId,
          sessionId,
        });
      }

      const dataStream = createDataStream({
        execute: async writer => {
          writer.writeMessageAnnotation({ type: 'CHAT_ID', value: chatId });
          streamResult.mergeIntoDataStream(writer);

          if (sources) {
            const resolved = (
              (await Promise.all(bookDetailsArray)).filter(
                Boolean,
              ) as BookDetailsResponse[]
            ).map(b => b.book);

            writeSources(writer, sources, resolved);
          }
        },
        onError: error => {
          console.log(error);
          return error instanceof Error ? error.message : String(error);
        },
      });

      return dataStreamToResponse(c, dataStream);
    }

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

        const books = (
          await Promise.all(
            sources.map(async source => {
              return getBookById(source.node.metadata.bookId, locale);
            }),
          )
        ).filter(Boolean) as BookDto[];

        writeSources(writer, sources, books);
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
