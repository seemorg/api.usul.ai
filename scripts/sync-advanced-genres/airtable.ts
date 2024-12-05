import Airtable from 'airtable';

if (!process.env.AIRTABLE_GENRES_TOKEN || !process.env.AIRTABLE_GENRES_APP_ID) {
  throw new Error('AIRTABLE_GENRES_TOKEN and AIRTABLE_GENRES_APP_ID are not set');
}

export const genresAirtable = new Airtable({
  apiKey: process.env.AIRTABLE_GENRES_TOKEN,
}).base(process.env.AIRTABLE_GENRES_APP_ID);
