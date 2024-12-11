import { Hono } from 'hono';
import { compress } from 'hono/compress';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { HTTPException } from 'hono/http-exception';

import routes from './routes';
import { env } from './env';

// import './queues/ai-indexer/worker';
// import './queues/keyword-indexer/worker';
import './queues/flatten-metadata/worker';

const app = new Hono();

app.use(secureHeaders());
app.use(compress());
app.use(cors());

app.route('/', routes);

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
