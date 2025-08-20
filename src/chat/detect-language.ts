import { langfuse } from '@/lib/langfuse';
import { getLangfuseArgs, miniModel } from '@/lib/llm';
import { generateObject } from 'ai';

import { z } from 'zod';

const schema = z.object({
  language: z.string(),
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
      output: 'no-schema',
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
          reasoningEffort: 'minimal',
        },
      },
    });

    const object = schema.parse(response.object);
    return object.language;
  } catch (error) {
    console.log(error);
    return 'English';
  }
}
