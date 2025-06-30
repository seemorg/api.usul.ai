import { langfuse } from '@/lib/langfuse';
import { model } from '@/lib/llm';
import { BookDetailsResponse } from '@/routes/book/details';
import { smoothStream, streamText, type CoreMessage } from 'ai';

export async function answerAuthorQuery({
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
  const prompt = await langfuse.getPrompt('non-rag.author');
  const author = bookDetails.book.author;

  const compiledPrompt = prompt.compile({
    primaryName: author.primaryName!,
    transliteration: author.transliteration!,
    otherNames:
      author.otherNames && author.otherNames.length > 0
        ? author.otherNames.join(', ')
        : '-',
    secondaryName: author.secondaryName ?? '-',
    secondaryOtherNames:
      author.secondaryOtherNames && author.secondaryOtherNames.length > 0
        ? author.secondaryOtherNames.join(', ')
        : '-',
    deathYear: author.year && author.year !== -1 ? `${author.year} Hijri` : 'Unknown',
    numberOfBooks: author.numberOfBooks.toString(),
    bio: author.bio ?? '-',
  });

  const response = streamText({
    model,
    temperature: 0.5,
    system: compiledPrompt,
    messages: [...history, { role: 'user', content: query }],
    experimental_transform: smoothStream(),
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'Chat.OpenAI.NonRAG.Author', // Trace name
      metadata: {
        sessionId,
        langfuseTraceId: traceId,
        langfusePrompt: prompt.toJSON(),
      },
    },
  });

  return response;
}
