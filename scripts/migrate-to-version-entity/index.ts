import { db } from '@/lib/db';
import { chunk } from '@/lib/utils';
import { type Prisma, BookVersionSource } from '@prisma/client';
import oldFlags from './final.json';

const main = async () => {
  // console.log('DELETING ALL BOOK VERSIONS');
  // await db.bookVersion.deleteMany({});

  const existingBookVersions = await db.bookVersion.findMany({
    select: {
      id: true,
    },
  });
  const existingIds = new Set(existingBookVersions.map(v => v.id));

  const books = await db.book.findMany({
    select: {
      id: true,
      versions: true,
    },
  });

  const allVersions = books
    .flatMap(book =>
      book.versions.map(
        (version): Prisma.BookVersionCreateManyInput => ({
          id: version.id,
          bookId: book.id,
          source: {
            turath: BookVersionSource.Turath,
            openiti: BookVersionSource.Openiti,
            pdf: BookVersionSource.Pdf,
            external: BookVersionSource.External,
          }[version.source],
          value: version.value,
          aiSupported: version.aiSupported || oldFlags[book.id]?.[version.value]?.ai,
          keywordSupported:
            version.keywordSupported || oldFlags[book.id]?.[version.value]?.keyword,
          ...('pdfUrl' in version ? { pdfUrl: version.pdfUrl } : {}),
          ...('ocrBookId' in version ? { ocrBookId: version.ocrBookId } : {}),
          ...('splitsData' in version ? { splitsData: version.splitsData } : {}),
          investigator: version.publicationDetails?.investigator,
          publisher: version.publicationDetails?.publisher,
          publisherLocation: version.publicationDetails?.publisherLocation,
          editionNumber: version.publicationDetails?.editionNumber
            ? String(version.publicationDetails?.editionNumber)
            : null,
          publicationYear: version.publicationDetails?.publicationYear
            ? String(version.publicationDetails?.publicationYear)
            : null,
        }),
      ),
    )
    .filter(v => !existingIds.has(v.id));

  const batches = chunk(allVersions, 40);
  let i = 0;

  for (const batch of batches) {
    console.log(`Processing batch ${++i} / ${batches.length}`);

    await db.bookVersion.createMany({
      data: batch,
    });
  }
};

main();
