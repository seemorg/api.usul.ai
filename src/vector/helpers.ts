import type { Block } from '@openiti/markdown-parser';

export const deduplicateArray = <T>(arr: T[]) => [...new Set(arr)];

export function splitTextIntoSentences(text: string): string[] {
  // Arabic punctuation marks: . ! ؟ (Arabic question mark)
  const sentenceEndings = /(?<=[\.\!\؟\؟\؛])\s+|\n\n+/g;
  return text.split(sentenceEndings).filter(sentence => sentence.trim().length > 0);
}

export const convertOpenitiToHtml = (blocks: Block[]) => {
  return blocks
    .map(block => {
      if (block.type === 'paragraph') return `<p>${block.content}</p>`;
      if (block.type === 'header' || block.type === 'title') {
        // max level is 6
        const level = block.type === 'header' ? Math.min(6, block.level) : 1;
        return `<h${level}>${block.content}</h${level}>`;
      }

      if (block.type === 'blockquote') return `<blockquote>${block.content}</blockquote>`;
      if (block.type === 'verse') return `<p>${block.content.join('\t')}</p>`;

      return `<p>${block.content}</p>`;
    })
    .join(' ');
};
