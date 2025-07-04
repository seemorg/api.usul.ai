import { AzureSearchResult } from '@/book-search/search';
import { CoreMessage } from 'ai';

export function formatChatHistory(messages: CoreMessage[]) {
  return messages.map(m => `${m.role}: ${m.content as string}`).join('\n\n');
}

export function formatSources(sources: AzureSearchResult[]) {
  return sources
    .map((s, idx) => {
      const text = s.node.text;
      return `
<source_${idx + 1}>
${text}
</source_${idx + 1}>
`.trim();
    })
    .join('\n\n');
}
