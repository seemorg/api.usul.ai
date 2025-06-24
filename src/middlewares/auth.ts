import { HTTPException } from 'hono/http-exception';
import { createMiddleware } from 'hono/factory';
import { auth } from '../lib/auth';

export const requireAuth = createMiddleware<{
  Variables: {
    session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
  };
}>(async (c, next) => {
  try {
    const session = await auth.api.getSession(c.req.raw);

    if (!session) {
      throw new HTTPException(401, { message: 'Unauthenticated' });
    }

    // Add user to context
    c.set('session', session);

    await next();
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    throw new HTTPException(401, { message: 'Unauthenticated' });
  }
});
