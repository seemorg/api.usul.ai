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
export const populateAuthors = async () => {
  if (authorIdToAuthor) return;

  const authors = await get();
  authorIdToAuthor = authors.reduce((acc, author) => {
    acc[author.id] = author;
    return acc;
  }, {} as Record<string, RawAuthor>);
};
