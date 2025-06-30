import { langfuse } from '@/lib/langfuse';
import { model } from '@/lib/llm';
import { generateObject, generateText, type CoreMessage } from 'ai';

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
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'Chat.OpenAI.Router', // Trace name
      metadata: {
        // langfuseTraceId: "trace-123", // Langfuse trace
        // tags: ["story", "cat"], // Custom tags
        // userId: "user-123", // Langfuse user
        sessionId,
        langfusePrompt: prompt.toJSON(),
      },
    },
    system: compiledPrompt,
    messages: [
      ...history,
      {
        role: 'user',
        content: query,
      },
    ],
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
