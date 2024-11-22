import { Hono } from 'hono';
import { compress } from 'hono/compress';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { HTTPException } from 'hono/http-exception';

import routes from './routes';
// import './queues/ai-indexer/worker';
// import './queues/keyword-indexer/worker';

const app = new Hono();

app.use(secureHeaders());
app.use(compress());
app.use(cors());

app.route('/', routes);

app.onError(err => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  return new Response('Internal Server Error', { status: 500 });
});

export default app;
