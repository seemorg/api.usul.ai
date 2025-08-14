import { truncateHeadings } from '@/lib/headings';
import { langfuse } from '@/lib/langfuse';
import { streamText } from '@/lib/llm';
import { BookDetailsResponse } from '@/routes/book/details';
import { type CoreMessage } from 'ai';

export async function answerBookQuery({
  bookDetails,
  history,
  query,
  traceId,
  sessionId,
}: {
  bookDetails: BookDetailsResponse;
  history: CoreMessage[];
  query: string;
  traceId: string;
  sessionId: string;
}) {
  const prompt = await langfuse.getPrompt('non-rag.book');

  const book = bookDetails.book;
  const compiledPrompt = prompt.compile({
    primaryName: book.primaryName!,
    secondaryName: book.secondaryName ?? '-',
    slug: book.slug,
    numberOfVersions: book.numberOfVersions.toString(),
    versions: book.versions
      .map(v => `  * Value: ${v.value}, Source: ${v.source}`)
      .join('\n'),
    genres: book.genres
      .map(g => `  * Name: ${g.name}, Secondary Name: ${g.secondaryName}`)
      .join('\n'),
    tableOfContent: bookDetails.headings
      ? (
          truncateHeadings(bookDetails.headings) as (
            | { volume?: number; page?: number; title: string; level: number }
            | { page?: { vol: string; page: number }; title: string; level: number }
          )[]
        )
          .map((h, idx) => `${idx + 1}. ${h.title}`)
          .join('\n')
      : '-',
  });

  const response = streamText({
    temperature: 0.5,
    system: compiledPrompt,
    messages: [...history, { role: 'user', content: query }],
    langfuse: {
      name: 'Chat.OpenAI.NonRAG.Book',
      sessionId,
      traceId,
      prompt,
    },
  });

  return response;
}
