import { SentenceSplitter, Settings } from 'llamaindex';

Settings.chunkSize = 512;
Settings.chunkOverlap = 24;

export const splitter = new SentenceSplitter({
  chunkSize: 512,
  chunkOverlap: 20,
  secondaryChunkingRegex: '[^,.;。？！]+[,.;。？！!؟]?',
});
