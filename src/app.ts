import { Hono } from 'hono';
import { compress } from 'hono/compress';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { HTTPException } from 'hono/http-exception';

import routes from './routes';
import { env } from './env';
import { auth } from './lib/auth';
import { allowedOrigins } from './config';

// if (env.NODE_ENV === 'production') {
//   console.log('Starting workers');
//   await import('./queues/flatten-metadata/worker');
// }

const app = new Hono();

if (env.NODE_ENV === 'development') {
  const { logger } = await import('hono/logger');
  app.use(logger());
}

app.use(secureHeaders());
app.use(compress());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

app.route('/', routes);
app.on(['POST', 'GET'], '/api/auth/*', c => auth.handler(c.req.raw));

app.onError(err => {
  let extra = {};
  if (env.NODE_ENV === 'development') {
    extra = {
      name: err.name,
      cause: err.cause,
      stack: err.stack,
    };
  }

  if (err instanceof HTTPException) {
    return Response.json(
      {
        status: err.status,
        message: err.message,
        ...extra,
      },
      { status: err.status, headers: err.getResponse().headers },
    );
  }

  return Response.json(
    {
      status: 500,
      message: 'Internal Server Error',
      ...extra,
    },
    { status: 500 },
  );
});

export default app;
