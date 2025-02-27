import { makeAuthorDto } from '@/dto/author.dto';
import { env } from '@/env';
import { db } from '@/lib/db';
import { PathLocale } from '@/lib/locale';

export const getAuthorById = async (id: string, locale: PathLocale = 'en') => {
  const author =
    env.NODE_ENV === 'development'
      ? await db.author.findUnique({
          where: { id },
          include: {
            primaryNameTranslations: true,
            otherNameTranslations: true,
            bioTranslations: true,
          },
        })
      : authorIdToAuthor?.[id];
  if (!author) return null;

  return makeAuthorDto(author, locale);
};

export const getAuthorBySlug = async (slug: string, locale: PathLocale = 'en') => {
  const author =
    env.NODE_ENV === 'development'
      ? await db.author.findUnique({
          where: { slug },
          include: {
            primaryNameTranslations: true,
            otherNameTranslations: true,
            bioTranslations: true,
          },
        })
      : authorSlugToAuthor?.[slug];
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
  const authors = await get();

  authorIdToAuthor = {};
  authorSlugToAuthor = {};

  for (const author of authors) {
    authorIdToAuthor[author.id] = author;
    authorSlugToAuthor[author.slug] = author;
  }
};
