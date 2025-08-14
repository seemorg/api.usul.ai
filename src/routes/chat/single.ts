import { Context, Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { createDataStream, StreamTextResult, ToolSet } from 'ai';
import { routeQuery } from '@/chat/route-query';
import { getBookDetails } from '../book/details';
import { answerAuthorQuery } from '@/chat/author-chat';
import { answerBookQuery } from '@/chat/book-chat';
import { condenseMessageHistory } from '@/chat/condense-chat';
import { HTTPException } from 'hono/http-exception';
import { searchQueriesInParallel } from '@/book-search/search';
import { answerRagQuery } from '@/chat/rag';
import { dataStreamToResponse } from '@/lib/stream';
import { messagesSchema } from '@/validators/chat';
import { writeSourcesToStream } from '@/chat/utils';
import { generateQueries } from '@/chat/generate-queries';
import { rerankChunks } from '@/lib/cohere';

const singleChatRoutes = new Hono();

const getStreamResult = async (
  c: Context,
  chatId: string,
  streamResult: StreamTextResult<ToolSet, never>,
) => {
  const dataStream = createDataStream({
    execute: async writer => {
      writer.writeMessageAnnotation({ type: 'CHAT_ID', value: chatId });
      streamResult.mergeIntoDataStream(writer);
    },
    onError: error => {
      console.log(error);
      return error instanceof Error ? error.message : String(error);
    },
  });

  return dataStreamToResponse(c, dataStream);
};

singleChatRoutes.post(
  '/:bookId/:versionId',
  zValidator(
    'json',
    z.object({
      isRetry: z.boolean().optional(),
      messages: messagesSchema,
      chatId: z.string().optional(),
    }),
  ),
  async c => {
    const body = c.req.valid('json');
    const traceId = uuidv4();
    const sessionId = body.chatId ?? uuidv4();

    const bookId = c.req.param('bookId');
    const versionId = c.req.param('versionId');

    // get last 6 messages
    const lastMessage = body.messages[body.messages.length - 1].content;
    const messages = body.messages.slice(0, body.messages.length - 1);
    const chatHistory = messages.slice(-6);

    const bookDetails = await getBookDetails(bookId);
    if ('type' in bookDetails) {
      throw new HTTPException(400);
    }

    const version = bookDetails.book.versions.find(v => v.id === versionId);
    if (!version) {
      throw new Error('Version not found');
    }

    const routerResult = await routeQuery(chatHistory, lastMessage, sessionId);
    if (routerResult === 'author') {
      const streamResult = await answerAuthorQuery({
        author: bookDetails.book.author,
        history: chatHistory,
        query: lastMessage,
        traceId,
        sessionId,
      });
      return getStreamResult(c, traceId, streamResult);
    }

    if (routerResult === 'summary') {
      const streamResult = await answerBookQuery({
        bookDetails,
        history: chatHistory,
        query: lastMessage,
        traceId,
        sessionId,
      });
      return getStreamResult(c, traceId, streamResult);
    }

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
        const [searchResults, rerankQuery] = await Promise.all([
          searchQueriesInParallel([...queries, lastMessage], {
            books: [
              {
                id: bookDetails.book.id,
                sourceAndVersion: `${version.source}:${version.value}`,
              },
            ],
          }),
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

        const result = await answerRagQuery({
          bookDetails,
          history: chatHistory,
          query: lastMessage, // use last message and not ragQuery to preserve context
          sources: sources!,
          isRetry: body.isRetry,
          traceId,
          sessionId,
        });
        result.mergeIntoDataStream(writer);

        writeSourcesToStream(writer, sources);
      },
      onError: error => {
        console.log(error);
        return error instanceof Error ? error.message : String(error);
      },
    });

    return dataStreamToResponse(c, dataStream);
  },
);

export default singleChatRoutes;
