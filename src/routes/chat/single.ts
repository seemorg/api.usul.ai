import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { stream } from 'hono/streaming';
import { v4 as uuidv4 } from 'uuid';
import { createDataStream, StreamTextResult, ToolSet } from 'ai';
import { routeQuery } from '@/chat/route-query';
import { getBookDetails } from '../book/details';
import { answerAuthorQuery } from '@/chat/author-chat';
import { answerBookQuery } from '@/chat/book-chat';
import { condenseMessageHistory } from '@/chat/condense-chat';
import { HTTPException } from 'hono/http-exception';
import { AzureSearchResult, searchBook } from '@/book-search/search';
import { answerRagQuery } from '@/chat/rag';
import { dataStreamToResponse } from '@/lib/stream';
import { messagesSchema } from '@/validators/chat';

const singleChatRoutes = new Hono();

singleChatRoutes.post(
  '/:bookId/:versionId',
  zValidator(
    'json',
    z.object({
      isRetry: z.boolean().optional(),
      messages: messagesSchema,
    }),
  ),
  async c => {
    const body = c.req.valid('json');
    const chatId = uuidv4();
    const sessionId = uuidv4();

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

    const routerResult = await routeQuery(chatHistory, lastMessage, sessionId);

    let streamResult: StreamTextResult<ToolSet, never>;
    let sources: AzureSearchResult[] | null = null;
    if (routerResult === 'author') {
      streamResult = await answerAuthorQuery({
        author: bookDetails.book.author,
        history: chatHistory,
        query: lastMessage,
        traceId: chatId,
        sessionId,
      });
    } else if (routerResult === 'summary') {
      streamResult = await answerBookQuery({
        bookDetails,
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

      const version = bookDetails.book.versions.find(v => v.id === versionId);
      if (!version) {
        throw new Error('Version not found');
      }

      sources = await searchBook({
        books: [
          {
            id: bookDetails.book.id,
            sourceAndVersion: `${version.source}:${version.value}`,
          },
        ],
        query: ragQuery,
        type: 'vector',
        limit: 50,
        rerank: true,
        rerankLimit: 10,
      }).then(r => r.results);

      streamResult = await answerRagQuery({
        bookDetails,
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
        if (sources) {
          writer.writeMessageAnnotation({
            type: 'SOURCES',
            value: sources.map(source => ({
              score: source.score,
              text: source.node.text,
              metadata: source.node.metadata,
            })),
          });
        }

        writer.writeMessageAnnotation({ type: 'CHAT_ID', value: chatId });
        streamResult.mergeIntoDataStream(writer);
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
