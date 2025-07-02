import type { createDataStream } from 'ai';
import type { Context } from 'hono';
import { stream } from 'hono/streaming';

const setStreamingHeaders = (c: Context) => {
  // Mark the response as a v1 data stream:
  c.header('X-Vercel-AI-Data-Stream', 'v1');
  c.header('Content-Type', 'text/plain; charset=utf-8');
  c.header('Transfer-Encoding', 'chunked');
  c.header('Connection', 'keep-alive');
  c.header('Content-Encoding', 'none');
};

export const dataStreamToResponse = (
  c: Context,
  dataStream: ReturnType<typeof createDataStream>,
) => {
  setStreamingHeaders(c);
  return stream(c, s => s.pipe(dataStream.pipeThrough(new TextEncoderStream())));
};
