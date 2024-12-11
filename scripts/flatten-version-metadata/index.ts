// import { db } from '@/lib/db';
// import { fetchTurathBookById, getTurathPdfDetails } from '@/book-fetchers/turath';

import { fetchBookContent } from '@/book-fetchers';
import { db } from '@/lib/db';

const main = async () => {
  const id = '0852IbnHajarCasqalani.BulughMaram';

  const book = await db.book.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      versions: true,
      authorId: true,
    },
  });

  if (!book) {
    throw new Error(`Book not found: ${id}`);
  }

  for (const version of book.versions) {
    if (version.source !== 'openiti' && version.source !== 'turath') {
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
      throw new Error(`Book content not found: ${book.id}`);
    }

    const publicationDetails = bookContent.publicationDetails;
    let pdfUrl: string | undefined;

    if ('pdf' in bookContent && bookContent.pdf) {
      pdfUrl = bookContent.pdf;
    }

    console.log({ publicationDetails, pdfUrl });
  }

  // const booksToFlatten = books.filter(book =>
  //   book.versions.some(
  //     version => version.source === 'openiti' || version.source === 'turath',
  //   ),
  // );
  // const res = await fetchTurathBookById(1673);
  // const pdf = getTurathPdfDetails(res.meta.pdf_links, res.indexes.volumes);
  // console.log({
  //   pdf,
  // });
};

main();

// turath:
// https://files.turath.io/pdf/شروح الحديث/فتح الباري بشرح صحيح البخاري - ابن حجر - ط السلفية 01-13/01p_2021.pdf

// us:
// https://files.turath.io/pdf/شروح الحديث/فتح الباري بشرح صحيح البخاري - ابن حجر - ط السلفية 01-13/00_2021.pdf|الغلاف
