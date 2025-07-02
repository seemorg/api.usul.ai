import { langfuse } from '@/lib/langfuse';
import { getLangfuseArgs, model } from '@/lib/llm';
import { generateObject, type CoreMessage } from 'ai';

export async function routeQuery(
  history: CoreMessage[],
  query: string,
  sessionId: string,
) {
  const prompt = await langfuse.getPrompt('router');
  const compiledPrompt = prompt.compile();

  const response = await generateObject({
    model,
    output: 'no-schema',
    system: compiledPrompt,
    messages: [
      ...history,
      {
        role: 'user',
        content: query,
      },
    ],
    ...getLangfuseArgs({
      name: 'Chat.OpenAI.Router', // Trace name
      sessionId,
      prompt,
    }),
  });

  const result = response.object as {
    intent: 'A' | 'B' | 'C';
  };

  if (!result) {
    return 'content';
  }

  const parsedIntent = ({ A: 'author', B: 'summary', C: 'content' } as const)[
    result.intent
  ];

  return parsedIntent;
}
