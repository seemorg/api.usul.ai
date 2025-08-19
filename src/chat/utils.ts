import { AzureSearchResult } from '@/book-search/search';
import { BookDto } from '@/dto/book.dto';
import { getBookById } from '@/services/book';
import { CoreMessage, DataStreamWriter } from 'ai';

export function formatChatHistory(messages: CoreMessage[]) {
  return messages.map(m => `${m.role}: ${m.content as string}`).join('\n\n');
}

export function formatSources(sources: AzureSearchResult[]) {
  return sources
    .map((s, idx) => {
      const text = s.node.text;
      const book = getBookById(s.node.metadata.bookId, 'ar');

      return `
<source_${idx + 1}>
  ${
    book
      ? `<book_name>${book.primaryName ?? book.secondaryName}</book_name>
  <author_name>${book.author.primaryName ?? book.author.secondaryName}</author_name>`
      : ''
  }
  <source_text>
  ${text}
  </source_text>
</source_${idx + 1}>
`;
    })
    .join('\n\n');
}

export const writeSourcesToStream = (
  writer: DataStreamWriter,
  sources: AzureSearchResult[],
  books?: BookDto[],
) => {
  writer.writeMessageAnnotation({
    type: 'SOURCES',
    value: sources.map(source => {
      const book = books?.find(b => b.id === source.node.metadata.bookId);

      return {
        id: source.node.id,
        score: source.score,
        text: source.node.text,
        metadata: source.node.metadata,
        book: book
          ? {
              primaryName: book.primaryName!,
              slug: book.slug,
            }
          : null,
      };
    }),
  });
};
