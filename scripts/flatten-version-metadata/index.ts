// import { db } from '@/lib/db';
// import { fetchTurathBookById, getTurathPdfDetails } from '@/book-fetchers/turath';

const main = async () => {
  // const books = await db.book.findMany({
  //   select: {
  //     id: true,
  //     versions: true,
  //   },
  // });
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
