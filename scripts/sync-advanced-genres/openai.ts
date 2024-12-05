import { AppLocale, locales } from '@/lib/locale';
import { sleep } from '@/lib/utils';
import { AzureOpenAI } from 'openai';
import { z } from 'zod';

if (
  !process.env.AZURE_OPENAI_DEPLOYMENT_NAME ||
  !process.env.AZURE_OPENAI_RESOURCE_NAME ||
  !process.env.AZURE_OPENAI_KEY
) {
  throw new Error(
    'AZURE_OPENAI_DEPLOYMENT_NAME, AZURE_OPENAI_RESOURCE_NAME and AZURE_OPENAI_KEY are not set',
  );
}

const openai = new AzureOpenAI({
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
  apiVersion: '2024-10-21',
  endpoint: `https://${process.env.AZURE_OPENAI_RESOURCE_NAME}.openai.azure.com/`,
  apiKey: process.env.AZURE_OPENAI_KEY,
});

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
    const completion = await openai.chat.completions.create({
      model: '',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT(type, localeCode) },
        { role: 'user', content: `"${name}"` },
      ],
    });

    const result = completion.choices[0]?.message.content;
    if (!result) return null;

    const parsedResult = schema.safeParse(JSON.parse(result));
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
