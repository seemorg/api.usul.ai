import { AzureSearchResult } from '@/book-search/search';

import { langfuse } from '@/lib/langfuse';
import { model } from '@/lib/llm';
import { BookDetailsResponse } from '@/routes/book/details';
import { smoothStream, streamText, type CoreMessage } from 'ai';

function formatSources(sources: AzureSearchResult[]) {
  return sources
    .map((s, idx) => {
      const text = s.node.text;
      return `[${idx + 1}]: ${text}`;
    })
    .join('\n\n');
}

export async function answerRagQuery({
  bookDetails,
  history,
  query,
  sources,
  isRetry,
  traceId,
  sessionId,
}: {
  isRetry?: boolean;
  bookDetails: BookDetailsResponse;
  history: CoreMessage[];
  sources: AzureSearchResult[];
  query: string;
  traceId: string;
  sessionId: string;
}) {
  const prompt = await langfuse.getPrompt('rag');

  const bookName = bookDetails.book.primaryName;
  const authorName = bookDetails.book.author.primaryName;

  const compiledPrompt = prompt.compile();

  const response = streamText({
    model,
    temperature: 0.5,
    system: compiledPrompt,
    experimental_transform: smoothStream(),
    messages: [
      ...history,
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `
Most relevant search results in "${bookName}" by "${authorName}":
${formatSources(sources)}
        `.trim(),
          },
          {
            type: 'text',
            text: `
User's query:
${query}
        `.trim(),
          },
        ],
      },
    ],
    experimental_telemetry: {
      isEnabled: true,
      functionId: `Chat.OpenAI.RAG${isRetry ? '.Retry' : ''}`, // Trace name
      metadata: {
        sessionId,
        langfuseTraceId: traceId,
        langfusePrompt: prompt.toJSON(),
      },
    },
  });

  return response;
}
