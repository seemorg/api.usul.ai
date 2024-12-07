import { serve } from '@hono/node-server';
import app from './app';
import { env } from './env';
import { setUptime } from './lib/uptime';
import { populateAuthors } from './services/author';
import { populateGenres } from './services/genre';
import { populateBooks } from './services/book';
import { createKeywordSearchIndexIfNotExists } from './lib/keyword-search';
import { createIndexIfNotExists } from './vector/vector-store';
import { populateRegions } from './services/region';
import { populateLocations } from './services/location';
import { populateAlternateSlugs } from './services/alternate-slugs';

// before the server starts, we need to populate the cache
console.log('🔄 Populating cache...');
await populateGenres();
await populateRegions();
await populateLocations();
await populateAlternateSlugs();

if (env.NODE_ENV !== 'development') {
  await populateAuthors();
  await populateBooks();
}

await createKeywordSearchIndexIfNotExists();
await createIndexIfNotExists();

serve(
  {
    fetch: app.fetch,
    port: env.PORT ?? 8080,
  },
  ({ address, port }) => {
    setUptime();
    console.log(`⚡ Server is running on ${address}:${port}`);
  },
);
