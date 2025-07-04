import { db } from '@/lib/db';
import { env } from '@/env';
import fs from 'fs';
import path from 'path';

export const getBookByAlternateSlug = (slug: string) => {
  const bookId = bookSlugToId?.[slug];
  if (!bookId) return null;
  return bookId;
};

export const getAuthorByAlternateSlug = (slug: string) => {
  const authorId = authorSlugToId?.[slug];
  if (!authorId) return null;
  return authorId;
};

const get = () =>
  Promise.all([db.bookAlternateSlug.findMany(), db.authorAlternateSlug.findMany()]);

let bookSlugToId: Record<string, string> | null = null;
let authorSlugToId: Record<string, string> | null = null;

export const populateAlternateSlugs = async () => {
  let data: Awaited<ReturnType<typeof get>> | undefined;
  const filePath = path.resolve('.cache/alternate-slugs.json');
  if (env.NODE_ENV === 'development') {
    // load from local
    if (fs.existsSync(filePath)) {
      data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  }

  if (!data) {
    data = await get();
    if (env.NODE_ENV === 'development') {
      // write to cache
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
    }
  }

  const [bookSlugs, authorSlugs] = data;

  bookSlugToId = {};
  authorSlugToId = {};

  for (const slug of bookSlugs) {
    bookSlugToId[slug.slug] = slug.bookId;
  }

  for (const slug of authorSlugs) {
    authorSlugToId[slug.slug] = slug.authorId;
  }
};
