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

export async function answerMultiBookAuthorQuery({
  bookDetailsArray,
  history,
  query,
  traceId,
  sessionId,
}: {
  bookDetailsArray: BookDetailsResponse[];
  history: CoreMessage[];
  query: string;
  traceId: string;
  sessionId: string;
}) {
  // Get unique authors from all books
  const authors = bookDetailsArray.map(book => book.book.author);
  const uniqueAuthors = authors.filter(
    (author, index, self) => index === self.findIndex(a => a.id === author.id),
  );

  // If all books have the same author, use the single author approach
  if (uniqueAuthors.length === 1) {
    const author = uniqueAuthors[0]!;
    return answerAuthorQuery({ author, history, query, traceId, sessionId });
  }

  const prompt = await langfuse.getPrompt('non-rag.multi-author');

  const context = uniqueAuthors
    .map((author, index) => {
      return `
## Author ${index + 1}: 
- Primary Name: ${author.primaryName}
- Transliteration: ${author.transliteration}
- Secondary Name: ${author.secondaryName}
- Other Names: ${author.otherNames && author.otherNames.length > 0 ? author.otherNames.join(', ') : '-'}
- Secondary Other Names: ${author.secondaryOtherNames && author.secondaryOtherNames.length > 0 ? author.secondaryOtherNames.join(', ') : '-'}
- Death Year: ${author.year && author.year !== -1 ? `${author.year} Hijri` : 'Unknown'}
- Number of Books: ${author.numberOfBooks}
- Bio: ${author.bio ?? '-'}
`;
    })
    .join('\n\n');

  const compiledPrompt = prompt.compile({
    context,
  });

  const response = streamText({
    temperature: 0.5,
    system: compiledPrompt,
    messages: [...history, { role: 'user', content: query }],
    langfuse: {
      name: 'Chat.OpenAI.MultiBook.Author',
      sessionId,
      traceId,
      prompt,
    },
  });

  return response;
}
