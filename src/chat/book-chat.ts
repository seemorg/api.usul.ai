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
      truncateHeadings(bookDetails.headings) as (
        | { volume?: number; page?: number; title: string; level: number }
        | { page?: { vol: string; page: number }; title: string; level: number }
      )[]
    )
      .map((h, idx) => `${idx + 1}. ${h.title}`)
      .join('\n'),
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

export async function answerMultiBookQuery({
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
  const prompt = await langfuse.getPrompt('non-rag.multi-book');

  // If there's only one book, use the single book approach
  if (bookDetailsArray.length === 1) {
    return answerBookQuery({
      bookDetails: bookDetailsArray[0]!,
      history,
      query,
      traceId,
      sessionId,
    });
  }

  // For multiple books, create a combined context
  const context = `
${bookDetailsArray
  .map((bookDetails, index) => {
    const book = bookDetails.book;
    return `
## Book ${index + 1}: 
- Primary Name: ${book.primaryName}
- Transliteration: ${book.transliteration}
- Secondary Name: ${book.secondaryName ?? '-'}
- Slug: ${book.slug}
- Author Primary Name: ${book.author.primaryName}
- Author Secondary Name: ${book.author.secondaryName}
- Number of Versions: ${book.numberOfVersions}
- Versions: 
${book.versions.map(v => `  * Value: ${v.value}, Source: ${v.source}`).join('\n')}
- Genres: 
${book.genres
  .map(g => `  * Name: ${g.name}, Secondary Name: ${g.secondaryName}`)
  .join('\n')}

- Table of Contents: 
${(truncateHeadings(bookDetails.headings, 5) as any[])
  .map((h, idx) => `${idx + 1}. ${h.title}`)
  .join('\n')}${bookDetails.headings.length > 5 ? '\n...' : ''}`;
  })
  .join('\n\n')}  
`;

  const compiledPrompt = prompt.compile({
    context,
  });

  const response = streamText({
    temperature: 0.5,
    system: compiledPrompt,
    messages: [...history, { role: 'user', content: query }],
    langfuse: {
      name: 'Chat.OpenAI.MultiBook.Book',
      sessionId,
      traceId,
      prompt,
    },
  });

  return response;
}
