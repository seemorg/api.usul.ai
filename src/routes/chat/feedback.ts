import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { langfuse } from '@/lib/langfuse';

const feedbackRoutes = new Hono();

feedbackRoutes.post(
  '/feedback/:chatId',
  zValidator(
    'json',
    z.object({
      feedback: z.enum(['positive', 'negative']),
    }),
  ),
  async c => {
    const body = c.req.valid('json');
    const chatId = c.req.param('chatId');

    langfuse.score({
      traceId: chatId,
      name: 'user_feedback',
      value: body.feedback === 'negative' ? 0 : 1,
    });

    return c.json({ success: true });
  },
);

export default feedbackRoutes;
