import { AzureSearchResult } from '@/book-search/search';

import { langfuse } from '@/lib/langfuse';
import { streamText } from '@/lib/llm';
import { BookDetailsResponse } from '@/routes/book/details';
import { type CoreMessage } from 'ai';

function formatSources(sources: AzureSearchResult[]) {
  return sources
    .map((s, idx) => {
      const text = s.node.text;
      return `
<chunk_${idx + 1}>
${text}
</chunk_${idx + 1}>
`.trim();
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
    temperature: 0.5,
    system: compiledPrompt,
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
<query>
${query}
</query>
        `.trim(),
          },
        ],
      },
    ],
    langfuse: {
      name: `Chat.OpenAI.RAG${isRetry ? '.Retry' : ''}`,
      sessionId,
      traceId,
      prompt,
    },
  });

  return response;
}

export async function answerMultiBookRagQuery({
  history,
  query,
  sources,
  isRetry,
  traceId,
  sessionId,
}: {
  isRetry?: boolean;
  history: CoreMessage[];
  sources: AzureSearchResult[];
  query: string;
  traceId: string;
  sessionId: string;
}) {
  const prompt = await langfuse.getPrompt('multi-rag');

  const compiledPrompt = prompt.compile();

  const response = streamText({
    temperature: 0.5,
    system: compiledPrompt,
    messages: [
      ...history,
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `
Most relevant search results from multiple books:
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
    langfuse: {
      name: `Chat.OpenAI.MultiBookRAG${isRetry ? '.Retry' : ''}`,
      sessionId,
      traceId,
      prompt,
    },
  });

  return response;
}
