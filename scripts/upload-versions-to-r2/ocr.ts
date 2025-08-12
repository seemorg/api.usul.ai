import _uploadedVersions from '../../src/book-fetchers/uploaded-versions.json';
import { uploadToR2 } from '@/lib/r2';
import { writeFile } from 'fs/promises';
import path from 'path';
import * as cheerio from 'cheerio';

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.OCR_DATABASE_URL,
    },
  },
});

const booksSchema = z.array(
  z.object({
    id: z.string(),
    pdfUrl: z.string(),
    totalPages: z.number(),
    reviewedPages: z.number(),
    status: z.enum(['UNPROCESSED', 'PROCESSING', 'IN_REVIEW', 'COMPLETED']),
    usulBookId: z.string().nullable(),
  }),
);

const pagesSchema = z.array(
  z.object({
    id: z.string(),
    pageNumber: z.number().nullable(),
    volumeNumber: z.number().nullable(),
    pdfPageNumber: z.number(),
    bookId: z.string(),
    reviewed: z.boolean(),
    content: z.string().nullable(),
    footnotes: z.string().nullable(),
    editorialNotes: z.string().nullable(),
    flags: z.array(z.enum(['NEEDS_ADDITIONAL_REVIEW', 'EMPTY'])).nullable(),
  }),
);

const OUTPUT_PATH = path.join('src/book-fetchers', 'uploaded-versions.json');

const makeVersionKey = (source: string, value: string) =>
  `book-content/${source}/${value}.json`;

const uploadedVersions = _uploadedVersions as Record<string, boolean>;

const _results =
  await prisma.$queryRaw`SELECT * FROM "public"."Book" WHERE status = 'COMPLETED'`;
const books = booksSchema.parse(_results);

let i = 0;
for (const book of books) {
  const key = makeVersionKey('ocr', book.id);
  if (uploadedVersions[key]) {
    console.log(`Skipping ${++i} / ${books.length}`);
    continue;
  }

  console.log(`Uploading ${++i} / ${books.length}`);

  const _pages =
    await prisma.$queryRaw`SELECT * FROM "public"."Page" WHERE "bookId" = ${book.id} ORDER BY "pdfPageNumber" ASC`;
  const pages = pagesSchema.parse(_pages);

  const finalPages: {
    volume: number | null;
    page: number | null;
    content: string | null;
    footnotes: string | null;
    editorialNotes: string | null;
  }[] = [];
  const headings: {
    title: string;
    level: number;
    page: {
      volume: number | null;
      page: number | null;
    };
    pageIndex: number;
  }[] = [];

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const page = pages[pageIndex];
    const pageNumber = {
      volume: page.volumeNumber,
      page: page.pageNumber,
    };
    const currentPage = {
      ...pageNumber,
      content: page.content,
      footnotes: page.footnotes,
      editorialNotes: page.editorialNotes,
    };

    if (page.content) {
      const $ = cheerio.load(page.content);
      const pageHeadings = $('h1, h2, h3, h4, h5, h6')
        .map((_, el) => {
          const title = $(el).text();
          const level = parseInt(el.tagName.toLowerCase().replace('h', ''));

          return { title, level, page: pageNumber, pageIndex };
        })
        .get();

      if (pageHeadings.length > 0) {
        headings.push(...pageHeadings);
      }
    }

    finalPages.push(currentPage);
  }

  try {
    await uploadToR2(key, Buffer.from(JSON.stringify({ headings, pages: finalPages })), {
      contentType: 'application/json',
    });
    uploadedVersions[key] = true;
  } catch (e) {
    console.error(`Error uploading ${key}`);
  }

  // // write to file every 3 batches

  await writeFile(OUTPUT_PATH, JSON.stringify(uploadedVersions, null, 2));
}

console.log('Done!');
