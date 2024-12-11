import { Worker } from 'bullmq';

import type { FlattenMetadataQueueData } from './queue';
import { FLATTEN_METADATA_QUEUE_NAME, FLATTEN_METADATA_QUEUE_REDIS } from './queue';
import { fetchBookContent } from '@/book-fetchers';
import { getBookById } from '@/services/book';
import { loadPdf, mergePdfs } from '@/lib/pdf';
import { uploadToR2 } from '@/lib/r2';
import { db } from '@/lib/db';

export const worker = new Worker<FlattenMetadataQueueData>(
  FLATTEN_METADATA_QUEUE_NAME,
  async job => {
    const { bookId } = job.data;

    const book = await getBookById(bookId);

    if (!book) {
      throw new Error(`Book not found: ${bookId}`);
    }

    const hasVersionsToFlatten = book.versions.some(
      v => v.source === 'openiti' || v.source === 'turath',
    );

    if (!hasVersionsToFlatten) {
      throw new Error(`No versions to flatten: ${bookId}`);
    }

    const newVersions: PrismaJson.BookVersion[] = [];

    for (const version of book.versions) {
      if (version.source !== 'openiti' && version.source !== 'turath') {
        newVersions.push(version);
        continue;
      }

      const versionToFlatten = structuredClone(version);

      const bookContent = await fetchBookContent(
        {
          id: book.id,
          author: { id: book.author!.id },
          versions: book.versions,
        },
        versionToFlatten.value,
      );

      if (
        !bookContent ||
        bookContent.source === 'external' ||
        bookContent.source === 'pdf'
      ) {
        throw new Error(`Book content not found: ${bookId}`);
      }

      const pdfKey = `pdfs/${versionToFlatten.id}.pdf`;

      const publicationDetails = bookContent.publicationDetails;
      let pdfUrl: string | undefined;

      if ('pdf' in bookContent && bookContent.pdf) {
        if ('fullBookUrl' in bookContent.pdf) {
          const response = await fetch(bookContent.pdf.fullBookUrl);
          if (!response.ok || response.status >= 300) {
            throw new Error(`Failed to fetch PDF: ${bookContent.pdf.fullBookUrl}`);
          }

          const pdfBuffer = await response.arrayBuffer();

          await uploadToR2(pdfKey, Buffer.from(pdfBuffer), {
            contentType: 'application/pdf',
          });

          pdfUrl = `https://assets.usul.ai/${pdfKey}`;
        }

        if (Array.isArray(bookContent.pdf)) {
          const pdfs = [];
          for (const pdfUrl of bookContent.pdf) {
            pdfs.push(await loadPdf(pdfUrl.url));
          }

          const mergedPdf = await mergePdfs(pdfs);
          const pdfBuffer = await mergedPdf.save();

          await uploadToR2(pdfKey, Buffer.from(pdfBuffer), {
            contentType: 'application/pdf',
          });

          pdfUrl = `https://assets.usul.ai/${pdfKey}`;
        }
      }

      newVersions.push({
        ...versionToFlatten,
        pdfUrl,
        publicationDetails,
      });
    }

    await db.book.update({
      where: { id: bookId },
      data: {
        versions: newVersions,
      },
    });

    return { status: 'success', id: bookId };
  },
  {
    connection: FLATTEN_METADATA_QUEUE_REDIS,
    concurrency: 5,
  },
);
