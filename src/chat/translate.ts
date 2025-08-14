import { langfuse } from '@/lib/langfuse';
import { getLangfuseArgs, model } from '@/lib/llm';
import { AppLocale } from '@/lib/locale';
import { generateObject } from 'ai';
import { z } from 'zod';

const schema = z.object({
  translatedText: z.string(),
});

export async function translateChunk(chunk: string, languageCode: AppLocale) {
  const prompt = await langfuse.getPrompt('translate-source');
  const compiledPrompt = prompt.compile();

  const response = await generateObject({
    model,
    schema: schema,
    system: compiledPrompt,
    prompt: `
Language code: ${languageCode}

Text chunk:
${chunk}
`,
    ...getLangfuseArgs({
      name: 'Chat.OpenAI.TranslateChunk', // Trace name
      prompt,
    }),
  });

  return response.object.translatedText;
}
