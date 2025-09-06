import { AppLocale, locales } from '@/lib/locale';
import { sleep } from '@/lib/utils';
import { createAzure } from '@ai-sdk/azure';
import { generateObject } from 'ai';
import { AzureOpenAI } from 'openai';
import { z } from 'zod';

if (
  !process.env.AZURE_ENDPOINT_URL ||
  !process.env.AZURE_SECRET_KEY ||
  !process.env.AZURE_4_1_DEPLOYMENT
) {
  throw new Error(
    'AZURE_ENDPOINT_URL, AZURE_SECRET_KEY and AZURE_4_1_DEPLOYMENT are not set',
  );
}

const azure = createAzure({
  baseURL: process.env.AZURE_ENDPOINT_URL,
  apiKey: process.env.AZURE_SECRET_KEY,
  apiVersion: '2025-01-01-preview',
});

export const model = azure.languageModel(process.env.AZURE_4_1_DEPLOYMENT);

type Type = 'genre' | 'region';

const SYSTEM_PROMPT = (type: Type, locale: AppLocale) => {
  const language = locales.find(lang => lang.code === locale)!;

  return `
  You are a bot that takes ${
    type === 'region' ? 'a historice location' : 'an islamic genre'
  } name as an input and return two words in (${language.name}): 
  
  a) translation: the translation of the word in (${language.name})
  b) transliteration: how the Arabic word is spelled in English ${
    locale === 'en-US' ? '[using IJMES format]' : ''
  }
  
  You should return a json in this format: 
  
  {
    translation: String,
    transliteration: String,
  }
  `.trim();
};

const schema = z.object({
  translation: z.string(),
  transliteration: z.string(),
});

export const translateAndTransliterateName = async (
  type: Type,
  name: string,
  localeCode: AppLocale,
): Promise<{
  translation: string;
  transliteration: string;
} | null> => {
  try {
    const completion = await generateObject({
      model: model,
      output: 'no-schema',
      system: SYSTEM_PROMPT(type, localeCode),
      prompt: `${name}`,
    });

    const parsedResult = schema.safeParse(completion.object);
    if (!parsedResult.success) return null;

    return parsedResult.data;
  } catch (e: any) {
    if (e?.status === 429) {
      await sleep(2000);
      return translateAndTransliterateName(type, name, localeCode);
    }
    console.log(e);

    return null;
  }
};
