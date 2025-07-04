import { makeAuthorDto } from '@/dto/author.dto';
import { env } from '@/env';
import { db } from '@/lib/db';
import { PathLocale } from '@/lib/locale';
import fs from 'fs';
import path from 'path';

export const getAuthorById = async (id: string, locale: PathLocale = 'en') => {
  const author = authorIdToAuthor?.[id];
  if (!author) return null;

  return makeAuthorDto(author, locale);
};

export const getAuthorBySlug = async (slug: string, locale: PathLocale = 'en') => {
  const author = authorSlugToAuthor?.[slug];
  if (!author) return null;

  return makeAuthorDto(author, locale);
};

export const getAuthorCount = async () => {
  if (authorIdToAuthor) {
    return Object.keys(authorIdToAuthor).length;
  }

  return db.author.count();
};

const get = () =>
  db.author.findMany({
    include: {
      primaryNameTranslations: true,
      otherNameTranslations: true,
      bioTranslations: true,
    },
  });

type RawAuthor = Awaited<ReturnType<typeof get>>[number];

let authorIdToAuthor: Record<string, RawAuthor> | null = null;
let authorSlugToAuthor: Record<string, RawAuthor> | null = null;
export const populateAuthors = async () => {
  let authors: Awaited<ReturnType<typeof get>> | undefined;
  const filePath = path.resolve('.cache/authors.json');
  if (env.NODE_ENV === 'development') {
    // load from local
    if (fs.existsSync(filePath)) {
      authors = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  }

  if (!authors) {
    authors = await get();
    if (env.NODE_ENV === 'development') {
      // write to cache
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(authors), 'utf-8');
    }
  }

  authorIdToAuthor = {};
  authorSlugToAuthor = {};

  for (const author of authors) {
    authorIdToAuthor[author.id] = author;
    authorSlugToAuthor[author.slug] = author;
  }
};
