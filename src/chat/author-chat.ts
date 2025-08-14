import { langfuse } from '@/lib/langfuse';
import { streamText } from '@/lib/llm';
import { BookDetailsResponse } from '@/routes/book/details';
import { type CoreMessage } from 'ai';

export async function answerAuthorQuery({
  author,
  history,
  query,
  traceId,
  sessionId,
}: {
  author: BookDetailsResponse['book']['author'];
  history: CoreMessage[];
  query: string;
  traceId: string;
  sessionId: string;
}) {
  const prompt = await langfuse.getPrompt('non-rag.author');

  const compiledPrompt = prompt.compile({
    primaryName: author.primaryName!,
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
    temperature: 0.5,
    system: compiledPrompt,
    messages: [...history, { role: 'user', content: query }],
    langfuse: {
      name: 'Chat.OpenAI.NonRAG.Author',
      sessionId,
      traceId: traceId,
      prompt,
    },
  });

  return response;
}
