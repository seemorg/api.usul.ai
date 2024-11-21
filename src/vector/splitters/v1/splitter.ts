import { SentenceSplitter } from 'llamaindex';

export const splitter = new SentenceSplitter({
  chunkSize: 512,
  chunkOverlap: 20,
  secondaryChunkingRegex: '[^,.;。？！]+[,.;。？！!؟]?',
});
