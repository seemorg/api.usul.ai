import { langfuse } from '@/lib/langfuse';
import { model } from '@/lib/llm';
import { BookDetailsResponse } from '@/routes/book/details';
import { smoothStream, streamText, type CoreMessage } from 'ai';

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
    transliteration: book.transliteration!,
    secondaryName: book.secondaryName ?? '-',
    slug: book.slug,
    numberOfVersions: book.numberOfVersions.toString(),
    versions: book.versions
      .map(v => `  * Value: ${v.value}, Source: ${v.source}`)
      .join('\n'),
    genres: book.genres
      .map(g => `  * Name: ${g.name}, Secondary Name: ${g.secondaryName}`)
      .join('\n'),
    tableOfContent: (
      bookDetails.headings as (
        | { volume?: number; page?: number; title: string; level: number }
        | { page?: { vol: string; page: number }; title: string; level: number }
      )[]
    )
      .map((h, idx) => `${idx + 1}. ${h.title}`)
      .join('\n'),
  });

  const response = streamText({
    model,
    temperature: 0.5,
    system: compiledPrompt,
    experimental_transform: smoothStream(),
    messages: [...history, { role: 'user', content: query }],
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'Chat.OpenAI.NonRAG.Book', // Trace name
      metadata: {
        sessionId,
        langfuseTraceId: traceId,
        langfusePrompt: prompt.toJSON(),
      },
    },
  });

  return response;
}
