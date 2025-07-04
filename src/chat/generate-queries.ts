import { langfuse } from '@/lib/langfuse';
import { generateText } from '@/lib/llm';
import { type CoreMessage } from 'ai';
import { formatChatHistory } from './utils';
import { z } from 'zod';

const schema = z.object({
  queries: z.array(
    z.object({
      type: z.enum(['keyword', 'semantic']),
      query: z.string(),
    }),
  ),
});

export async function generateQueries({
  chatHistory,
  sessionId,
}: {
  chatHistory: CoreMessage[];
  sessionId: string;
}) {
  const prompt = await langfuse.getPrompt('generate-queries');
  const compiledPrompt = prompt.compile();

  const response = await generateText({
    system: compiledPrompt,
    prompt: `
Chat history:
${formatChatHistory(chatHistory)}
`.trim(),
    temperature: 0,
    langfuse: {
      name: `Chat.OpenAI.GenerateQueries`,
      sessionId,
      prompt,
    },
  });

  return schema.parse(JSON.parse(response.text)).queries;
}
