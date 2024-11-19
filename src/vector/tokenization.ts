import { get_encoding } from 'tiktoken';

/**
 * Steps for tokenization:
 * 1. Loop over all pages, and tokenize their content
 * 2. Group pages by chapters (level == 1):
 *  - for each page in the chapter, make a map of token start and end indices to it's index in the big pages array (to get metadata)
 * 3. Loop over chapters, split tokens into chunks with overlap, and map each chunk to the original pages it came from
 */

// cl100k_base is the encoding for text-embedding-3-large (our model)
const encoder = get_encoding('cl100k_base');
const textDecoder = new TextDecoder();

export function tokenize(text: string): Uint32Array {
  return encoder.encode(text);
}

export function detokenize(tokens: Uint32Array): string {
  const result = encoder.decode(tokens);
  return textDecoder.decode(result);
}
