import { z } from 'zod';

export const messagesSchema = z
  .array(
    z.object({
      role: z.enum(['assistant', 'user']),
      content: z.string(),
    }),
  )
  .min(1);
