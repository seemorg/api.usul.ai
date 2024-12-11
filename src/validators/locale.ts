import { zValidator } from '@hono/zod-validator';

import { PATH_LOCALES, PathLocale } from '@/lib/locale';
import { z } from 'zod';

export const localeSchema = z
  .enum<PathLocale, [PathLocale, ...PathLocale[]]>(
    PATH_LOCALES as [PathLocale, ...PathLocale[]],
  )
  .optional()
  .default('en')
  .catch('en');

export const localeQueryValidator = zValidator(
  'query',
  z.object({
    locale: localeSchema,
  }),
);
