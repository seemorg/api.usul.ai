import { get_encoding } from 'tiktoken';

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
