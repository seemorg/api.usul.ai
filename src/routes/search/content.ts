import { AzureSearchResult, searchBook } from '@/book-search/search';
import { langfuse } from '@/lib/langfuse';
import { getLangfuseArgs, model } from '@/lib/llm';
import { chunk } from '@/lib/utils';
import { getBookDetails } from '@/routes/book/details';
import { localeSchema } from '@/validators/locale';
import { zValidator } from '@hono/zod-validator';
import { generateObject } from 'ai';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const contentSearchRoutes = new Hono();

contentSearchRoutes.get(
  '/content',
  zValidator(
    'query',
    z.object({
      q: z.string().min(1),
      bookId: z.string().min(1),
      versionId: z.string().min(1),
      type: z.enum(['semantic', 'keyword']).optional().default('semantic'),
      page: z.coerce.number().min(1).optional().default(1),
      limit: z.coerce.number().min(1).max(100).optional().default(10),
      locale: localeSchema,
    }),
  ),
  async c => {
    const {
      bookId,
      versionId,
      q: query,
      type,
      locale,
      limit,
      page,
    } = c.req.valid('query');

    const bookDetails = await getBookDetails(bookId, locale);
    if (!bookDetails || 'type' in bookDetails) {
      throw new HTTPException(400, { message: 'Invalid book' });
    }

    const version = bookDetails.book.versions.find(v => v.id === versionId);

    if (!version) {
      throw new Error('Version not found');
    }

    const results = await searchBook({
      books: [
        {
          id: bookId,
          sourceAndVersion: `${version.source}:${version.value}`,
        },
      ],
      query,
      type: type === 'semantic' ? 'vector' : 'text',
      limit,
      page,
    });

    if (type === 'keyword') {
      return c.json({
        ...results,
        results: results.results.map(r => r.node),
      });
    }

    return c.json({
      ...results,
      results: await summarizeChunks(query, results.results),
    });
  },
);

const summarizeChunks = async (query: string, results: AzureSearchResult[]) => {
  const formattedResults = results.map(match => ({
    score: match.score,
    text: match.node.text,
    metadata: match.node.metadata,
  }));

  const batches = chunk(formattedResults, 5);
  const prompt = await langfuse.getPrompt('search.enhance');
  const compiledPrompt = prompt.compile();

  const summaries = await Promise.all(
    batches.map(async batch => {
      const result = await generateObject({
        model: model,
        system: compiledPrompt,
        output: 'no-schema',
        messages: [
          {
            role: 'user',
            content: `
Search Query: ${query}

Results: 
${batch.map((r, idx) => `[${idx}]. ${r.text}`).join('\n\n')}
    `.trim(),
          },
        ],
        ...getLangfuseArgs({
          name: 'Search.OpenAI.Book', // Trace name
          prompt,
        }),
      });

      return result.object as Record<number, string>;
    }),
  );

  return summaries.flatMap((parsed, idx) => {
    const batch = batches[idx];

    return batch.map((node, idx) => {
      if (!parsed[idx]) {
        return node;
      }

      return {
        ...node,
        text: replaceHighlights(parsed[idx]),
      };
    });
  });
};

// replace text in [[...]] with <em>...</em>
// replace text in [..] with <strong>...</strong>
const replaceHighlights = (text: string) => {
  return text
    .replace(/\[\[(.*?)\]\]/g, '<em>$1</em>')
    .replace(/\[(.*?)\]/g, '<strong>$1</strong>');
};

export default contentSearchRoutes;
