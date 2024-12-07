import { db } from '@/lib/db';

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
  const [bookSlugs, authorSlugs] = await get();

  if (!bookSlugToId) bookSlugToId = {};
  if (!authorSlugToId) authorSlugToId = {};

  for (const slug of bookSlugs) {
    bookSlugToId[slug.slug] = slug.bookId;
  }

  for (const slug of authorSlugs) {
    authorSlugToId[slug.slug] = slug.authorId;
  }
};
