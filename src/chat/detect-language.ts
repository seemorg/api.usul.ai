import { langfuse } from '@/lib/langfuse';
import { getLangfuseArgs, miniModel } from '@/lib/llm';
import { generateObject } from 'ai';

import { z } from 'zod';

const schema = z.object({
  language: z
    .string()
    .nullable()
    .describe(
      "The language of the user's query. Examples: English, Spanish, French, German, Italian, Portuguese, Russian, Chinese, Japanese, Korean, Arabic, Hebrew, etc.",
    ),
});

export async function detectLanguage({
  query,
  sessionId,
}: {
  query: string;
  sessionId: string;
}) {
  const prompt = await langfuse.getPrompt('detect-language');
  const compiledPrompt = prompt.compile();

  try {
    const response = await generateObject({
      model: miniModel,
      schema,
      system: compiledPrompt,
      prompt: query,
      temperature: 1,
      ...getLangfuseArgs({
        name: `Chat.OpenAI.DetectLanguage`,
        sessionId,
        prompt,
      }),
      providerOptions: {
        openai: {
          reasoningEffort: 'low',
        },
      },
    });

    return response.object.language || 'English';
  } catch (error) {
    console.log(error);
    return 'English';
  }
}
