import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { localeQueryValidator } from '@/validators/locale';
import { translateChunk } from '@/chat/translate';
import { pathLocaleToAppLocale } from '@/lib/locale';

const translateRoutes = new Hono();

translateRoutes.post(
  '/translate',
  localeQueryValidator,
  zValidator(
    'json',
    z.object({
      text: z.string(),
    }),
  ),
  async c => {
    const body = c.req.valid('json');
    const locale = c.req.valid('query').locale;

    const translatedText = await translateChunk(body.text, pathLocaleToAppLocale(locale));

    return c.json({ text: translatedText });
  },
);

export default translateRoutes;
