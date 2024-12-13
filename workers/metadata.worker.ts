import { db } from '@/lib/db';
import { removeFromR2, uploadToR2 } from '@/lib/r2';
import { fetchBookContent } from '@/book-fetchers';
import { SandboxedJob } from 'bullmq';
import { FlattenMetadataQueueData } from '@/queues/flatten-metadata/queue';
import { loadPdf, mergePdfs } from '@/lib/pdf';

export const metadataWorker = async (job: SandboxedJob<FlattenMetadataQueueData>) => {
  const { bookId } = job.data;

  const book = await db.book.findUnique({
    where: { id: bookId },
    select: {
      id: true,
      versions: true,
      authorId: true,
    },
  });

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
  const oldPdfKeys: string[] = [];

  for (const version of book.versions) {
    if (version.source !== 'openiti' && version.source !== 'turath') {
      newVersions.push(version);
      continue;
    }

    const versionToFlatten = structuredClone(version);
    const bookContent = await fetchBookContent(
      {
        id: book.id,
        author: { id: book.authorId },
        versions: book.versions,
      },
      versionToFlatten.value,
    );

    if (!bookContent) {
      throw new Error(`Book content not found: ${bookId}`);
    }

    // impossible, this is just for type safety
    if (bookContent.source !== 'turath' && bookContent.source !== 'openiti') {
      throw new Error(`Book content source not supported: ${bookContent.source}`);
    }

    if (bookContent.pdfUrl) {
      oldPdfKeys.push(bookContent.pdfUrl.replace('https://assets.usul.ai/', ''));
    }

    const pdfKey = `pdfs/${versionToFlatten.id}.pdf`;
    const publicationDetails = bookContent.sourcePublicationDetails;
    let pdfUrl: string | undefined;

    if ('sourcePdf' in bookContent && bookContent.sourcePdf) {
      if ('fullBookUrl' in bookContent.sourcePdf) {
        const response = await fetch(bookContent.sourcePdf.fullBookUrl);
        if (!response.ok || response.status >= 300) {
          throw new Error(`Failed to fetch PDF: ${bookContent.sourcePdf.fullBookUrl}`);
        }

        const pdfBuffer = await response.arrayBuffer();

        await uploadToR2(pdfKey, Buffer.from(pdfBuffer), {
          contentType: 'application/pdf',
        });

        pdfUrl = `https://assets.usul.ai/${pdfKey}`;
      }

      if (Array.isArray(bookContent.sourcePdf)) {
        const pdfs = [];
        for (const pdfUrl of bookContent.sourcePdf) {
          if (!pdfUrl) continue;
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

  if (oldPdfKeys.length > 0) {
    try {
      for (const key of oldPdfKeys) {
        await removeFromR2(key);
      }
    } catch (error) {
      console.error(error);
      await job.log('Failed to remove old PDFs from R2');
    }
  }

  return { status: 'success', id: bookId };
};

export default metadataWorker;
