import { Hono } from 'hono';
import { optionalAuth, requireAuth } from '@/middlewares/auth';
import { db } from '@/lib/db';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { Collection, CollectionVisibility, Prisma } from '@prisma/client';
import { createMiddleware } from 'hono/factory';
import {
  commonSearchSchema,
  formatBook,
  formatPagination,
  formatResults,
  prepareQuery,
  weightsMapToQueryWeights,
} from '../search/utils';
import { typesense } from '@/lib/typesense';
import { TypesenseBookDocument } from '@/types/typesense/book';
import { BOOKS_COLLECTION, booksQueryWeights } from '@/lib/typesense/collections';
import { SearchResponse } from 'typesense/lib/Typesense/Documents';
import { LRUCache } from 'lru-cache';

const collectionsRoutes = new Hono();

const collectionCache = new LRUCache<string, Collection & { books: string[] }>({
  max: 750,
  fetchMethod: async key => {
    const collection = await db.collection.findUnique({
      where: {
        slug: key,
      },
      include: {
        books: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!collection) {
      return;
    }

    return {
      ...collection,
      books: collection.books.map(b => b.id),
    };
  },
});

const disableCaching = createMiddleware(async (c, next) => {
  c.header('Cache-Control', 'no-store');
  await next();
});

// get all collections
collectionsRoutes.get('/', disableCaching, requireAuth, async c => {
  const { user } = c.var.session;

  const collections = await db.collection.findMany({
    where: {
      userId: user.id,
    },
  });

  return c.json({ data: collections });
});

// check slug
collectionsRoutes.post(
  '/check-slug',
  zValidator('json', z.object({ slug: z.string() })),
  async c => {
    const { slug } = c.req.valid('json');

    const collection = await db.collection.findUnique({
      where: {
        slug,
      },
      select: {
        id: true,
      },
    });

    return c.json({ exists: !!collection });
  },
);

// get a collection by slug
collectionsRoutes.get(
  '/by-slug/:slug',
  disableCaching,
  optionalAuth,
  zValidator(
    'query',
    commonSearchSchema.extend({
      genres: z
        .string()
        .transform(val => val.split(','))
        .pipe(z.array(z.string()))
        .optional(),
      authors: z
        .string()
        .transform(val => val.split(','))
        .pipe(z.array(z.string()))
        .optional(),
      regions: z
        .string()
        .transform(val => val.split(','))
        .pipe(z.array(z.string()))
        .optional(),
      yearRange: z
        .string()
        .transform(val => val.split(','))
        .pipe(z.tuple([z.coerce.number(), z.coerce.number()]))
        .optional(),
      sortBy: z.enum(['relevance', 'year-asc', 'year-desc']).optional(),
    }),
  ),
  async c => {
    const slug = c.req.param('slug');

    const collection = await collectionCache.fetch(slug);
    if (!collection) {
      throw new HTTPException(404, { message: 'Collection not found' });
    }

    const { q, limit, page, sortBy, genres, authors, regions, yearRange, locale } =
      c.req.valid('query');

    const filters: string[] = [];

    if (genres && genres.length > 0) {
      filters.push(`genreIds:[${genres.map(genre => `\`${genre}\``).join(', ')}]`);
    }
    if (authors && authors.length > 0) {
      filters.push(`authorId:[${authors.map(id => `\`${id}\``).join(', ')}]`);
    }
    if (regions && regions.length > 0) {
      filters.push(`regions:[${regions.map(region => `\`${region}\``).join(', ')}]`);
    }
    if (yearRange) {
      filters.push(`year:[${yearRange[0]}..${yearRange[1]}]`);
    }

    const ids = collection.books.map(b => `\`${b}\``);
    filters.push(`id:[${ids.join(', ')}]`);

    const results = await typesense.multiSearch.perform<TypesenseBookDocument[]>({
      searches: [
        {
          collection: BOOKS_COLLECTION.INDEX,
          q: prepareQuery(q),
          query_by: Object.values(booksQueryWeights).flat(),
          query_by_weights: weightsMapToQueryWeights(booksQueryWeights),
          prioritize_token_position: true,
          limit,
          page,
          ...(filters.length > 0 && { filter_by: filters.join(' && ') }),
          ...(sortBy && sortBy !== 'relevance'
            ? {
                sort_by: {
                  'year-asc': 'year:asc',
                  'year-desc': 'year:desc',
                }[sortBy],
              }
            : {}),
        },
        // ...(authors && authors.length > 0
        //   ? [
        //       {
        //         collection: AUTHORS_COLLECTION.INDEX,
        //         q: '',
        //         query_by: 'primaryNames.text',
        //         limit: 100,
        //         page: 1,
        //         filter_by: `id:[${authors.map(id => `\`${id}\``).join(', ')}]`,
        //       },
        //     ]
        //   : []),
      ],
    });

    const [booksResults] = results.results;

    return c.json({
      data: {
        ...collection,
        userId: undefined,
        isOwner: c.var.session?.user?.id === collection.userId,
        totalBooks: ids.length,
      },
      results: formatResults(
        booksResults as SearchResponse<TypesenseBookDocument>,
        'book',
        book => formatBook(book, locale),
      ),
      pagination: formatPagination(booksResults.found, booksResults.page, limit),
    });
  },
);

// add
collectionsRoutes.post(
  '/',
  requireAuth,
  zValidator(
    'json',
    z.object({
      name: z.string().min(1),
      description: z.string(),
      slug: z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .min(1),
      visibility: z.nativeEnum(CollectionVisibility),
    }),
  ),
  async c => {
    const { user } = c.var.session;
    const { name, description, slug, visibility } = c.req.valid('json');

    try {
      const collection = await db.collection.create({
        data: {
          name,
          description,
          slug,
          visibility,
          user: {
            connect: {
              id: user.id,
            },
          },
        },
      });

      return c.json({ data: collection });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new HTTPException(400, {
            message: 'Collection with this slug already exists',
          });
        }
      }

      throw new HTTPException(500, { message: 'Failed to create collection' });
    }
  },
);

// update
collectionsRoutes.put(
  '/:id',
  requireAuth,
  zValidator(
    'json',
    z.object({
      name: z.string().min(1),
      description: z.string(),
      slug: z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .min(1),
      visibility: z.nativeEnum(CollectionVisibility),
    }),
  ),
  async c => {
    const { user } = c.var.session;
    const id = c.req.param('id');
    const { name, description, slug, visibility } = c.req.valid('json');

    const collection = await db.collection.update({
      where: {
        id,
        userId: user.id,
      },
      data: {
        name,
        description,
        slug,
        visibility,
      },
    });

    if (!collection) {
      throw new HTTPException(404, { message: 'Collection not found' });
    }

    // invalidate cache
    collectionCache.delete(collection.slug);

    return c.json({ data: collection });
  },
);

// add book to collection
collectionsRoutes.post(
  '/:id/add-book',
  requireAuth,
  zValidator(
    'json',
    z.object({
      bookId: z.string(),
    }),
  ),
  async c => {
    const { user } = c.var.session;
    const id = c.req.param('id');
    const { bookId } = c.req.valid('json');

    const collection = await db.collection.update({
      where: {
        id,
        userId: user.id,
      },
      data: {
        books: {
          connect: {
            id: bookId,
          },
        },
      },
    });

    if (!collection) {
      throw new HTTPException(404, { message: 'Collection not found' });
    }

    // invalidate cache
    collectionCache.delete(collection.slug);

    return c.json({ data: collection });
  },
);

// remove book from collection
collectionsRoutes.post(
  '/:id/remove-book',
  requireAuth,
  zValidator('json', z.object({ bookId: z.string() })),
  async c => {
    const { user } = c.var.session;
    const id = c.req.param('id');
    const { bookId } = c.req.valid('json');

    const collection = await db.collection.update({
      where: {
        id,
        userId: user.id,
      },
      data: {
        books: {
          disconnect: { id: bookId },
        },
      },
    });

    if (!collection) {
      throw new HTTPException(404, { message: 'Collection not found' });
    }

    // invalidate cache
    collectionCache.delete(collection.slug);

    return c.json({ data: collection });
  },
);

// delete
collectionsRoutes.delete('/:id', requireAuth, async c => {
  const { user } = c.var.session;
  const id = c.req.param('id');

  const collection = await db.collection.delete({
    where: {
      id,
      userId: user.id,
    },
  });

  if (!collection) {
    throw new HTTPException(404, { message: 'Collection not found' });
  }

  // invalidate cache
  collectionCache.delete(collection.slug);

  return c.json({ data: collection });
});

export default collectionsRoutes;
