import { chunk } from '@/lib/utils';
import { db } from '@/lib/db';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { createId } from '@paralleldrive/cuid2';
import { fetchTurathBook } from '@/book-fetchers/turath';
import { uploadToR2 } from '@/lib/r2';
import { loadPdf, mergePdfs } from '@/lib/pdf';
import _turathBooks from './turath_books.json';
import _turathAuthorIdToUsulId from './turath-author-id-to-usul.json';

// const existingSlugs = new Set<string>(
//   await db.book
//     .findMany({ select: { slug: true, alternateSlugs: true } })
//     .then(books =>
//       books.flatMap(book => [
//         book.slug,
//         ...(book.alternateSlugs.map(alt => alt.slug) ?? []),
//       ]),
//     ),
// );

const bookSchema = z.object({
  turathId: z.number(),
  slug: z.string(),
  primaryNames: z.array(
    z.object({
      locale: z.string(),
      text: z.string(),
    }),
  ),
  variations: z.array(z.string()).nullable(),
  transliteration: z.string().nullable(),
  cover: z.string().url().optional(),
});

const books = z.array(bookSchema).parse(_turathBooks);
const turathAuthorIdToUsulId = z
  .record(z.string(), z.string())
  .parse(_turathAuthorIdToUsulId);

const existingTurathIdsToUsulAuthor = new Map<number, string>(
  (await db.book.findMany({ select: { versions: true, authorId: true } })).flatMap(book =>
    book.versions
      .filter(version => version.source === 'turath')
      .map(version => [Number(version.value), book.authorId]),
  ),
);

const turathAuthorsData = (
  (await (await fetch('https://files.turath.io/data-v3.json')).json()) as {
    authors: Record<number, { name: string; death: number | null; books: number[] }>;
  }
).authors;
const turathBookIdToAuthorId = Object.entries(turathAuthorsData).reduce(
  (acc, [authorId, { books }]) => {
    for (const bookId of books) {
      acc[bookId] = Number(authorId);
    }
    return acc;
  },
  {} as Record<number, number>,
);

const newBooks = books
  .filter(book => !existingTurathIdsToUsulAuthor.has(book.turathId))
  .map(book => {
    const authorId = turathBookIdToAuthorId[book.turathId];
    let usulAuthorId: string | null = turathAuthorIdToUsulId[authorId.toString()];

    if (!usulAuthorId) {
      // try to find the author using his other books and if they exist in usul
      const otherBooks = turathAuthorsData[authorId].books;
      for (const bookId of otherBooks) {
        const foundAuthorId = existingTurathIdsToUsulAuthor.get(bookId);
        if (foundAuthorId) {
          // Check if we already found a different author ID
          if (usulAuthorId && usulAuthorId !== foundAuthorId) {
            // If we find conflicting author IDs, don't use any
            usulAuthorId = null;
            break;
          }
          usulAuthorId = foundAuthorId;
        }
      }
    }

    return {
      ...book,
      usulAuthorId: usulAuthorId ?? null,
    };
  });

const validBooks = newBooks.filter(book => !!book.usulAuthorId);

const batches = chunk(validBooks, 5);

// log ones with same slug in existingSlugs
// console.dir(
//   validBooks.filter(book => existingSlugs.has(book.slug)),
//   { depth: null },
// );

let i = 0;
for (const batch of batches) {
  i++;
  console.log(`Processing batch ${i} / ${batches.length}`);

  const bookIdToVersion = (
    await Promise.all(
      batch.map(async book => {
        const turathData = await fetchTurathBook(book.turathId);
        const versionId = nanoid(10);

        // let finalPdfUrl: string | undefined;
        // const pdfKey = `pdfs/${versionId}.pdf`;

        // if (turathData.sourcePdf) {
        //   if ('fullBookUrl' in turathData.sourcePdf) {
        //     const response = await fetch(turathData.sourcePdf.fullBookUrl);
        //     if (!response.ok || response.status >= 300) {
        //       throw new Error(`Failed to fetch PDF: ${turathData.sourcePdf.fullBookUrl}`);
        //     }

        //     const pdfBuffer = await response.arrayBuffer();

        //     await uploadToR2(pdfKey, Buffer.from(pdfBuffer), {
        //       contentType: 'application/pdf',
        //     });

        //     finalPdfUrl = `https://assets.usul.ai/${pdfKey}`;
        //   }

        //   if (Array.isArray(turathData.sourcePdf)) {
        //     const pdfs = [];
        //     for (const pdfUrl of turathData.sourcePdf) {
        //       if (!pdfUrl) continue;
        //       pdfs.push(await loadPdf(pdfUrl.url));
        //     }

        //     const mergedPdf = await mergePdfs(pdfs);
        //     const pdfBuffer = await mergedPdf.save();

        //     await uploadToR2(pdfKey, Buffer.from(pdfBuffer), {
        //       contentType: 'application/pdf',
        //     });

        //     finalPdfUrl = `https://assets.usul.ai/${pdfKey}`;
        //   }
        // }

        return [
          {
            id: versionId,
            source: 'turath',
            value: book.turathId.toString(),
            publicationDetails: turathData.sourcePublicationDetails,
            // ...(finalPdfUrl ? { pdfUrl: finalPdfUrl } : {}),
          },
        ] satisfies PrismaJson.BookVersion[];
      }, {} as Record<number, PrismaJson.BookVersion[]>),
    )
  ).reduce((acc, curr) => {
    acc[curr[0]!.value] = curr;
    return acc;
  }, {} as Record<string, PrismaJson.BookVersion[]>);

  await db.$transaction(
    batch.map(book =>
      db.book.create({
        data: {
          id: createId(),
          author: { connect: { id: book.usulAuthorId! } },
          slug: book.slug,
          coverImageUrl: book.cover,
          transliteration: book.transliteration,
          primaryNameTranslations: {
            createMany: {
              data: book.primaryNames.map(name => ({
                locale: name.locale,
                text: name.text,
              })),
            },
          },
          versions: bookIdToVersion[book.turathId.toString()],
        },
      }),
    ),
  );
}
