import { db } from '@/lib/db';
import _invalidBooks from './invalid-books.json';
import turathToUsulAuthorId from './turath-author-id-to-usul.json';
import fs from 'fs';

const invalidBookTurathIds = new Set(
  Object.values(_invalidBooks).flatMap(author => author.books.map(book => book.turathId)),
);

const main = async () => {
  const existingTurathIds = new Set<number>(
    (
      await db.book.findMany({
        select: {
          versions: true,
        },
      })
    ).flatMap(v =>
      v.versions.filter(v => v.source === 'turath').map(v => Number(v.value)),
    ),
  );

  const turathData = (await (
    await fetch('https://files.turath.io/data-v3.json')
  ).json()) as {
    authors: Record<string, { name: string; death: number | null; books: number[] }>;
    books: Record<string, { id: number; name: string; author_id: number }>;
  };
  const turathBooks = turathData.books;
  const turathAuthors = turathData.authors;

  const turathBookIdToAuthorId = Object.fromEntries(
    Object.entries(turathAuthors).flatMap(([authorId, author]) =>
      author.books.map(book => [book, authorId]),
    ),
  );

  const turathBooksData = Object.values(turathAuthors).flatMap(author => author.books);
  const missingVersions = turathBooksData.filter(
    bookId => !existingTurathIds.has(bookId) && !invalidBookTurathIds.has(bookId),
  );

  let i = 0;
  let linkedAuthor = 0;
  missingVersions.forEach(bookId => {
    const authorId = turathBookIdToAuthorId[bookId];
    if (_invalidBooks[authorId]) {
      i++;
      // add book to array
      _invalidBooks[authorId].books.push({
        turathId: bookId,
        arabicName: turathBooks[bookId].name,
        url: `https://app.turath.io/book/${bookId}`,
        usulUrl: '',
      });
    } else {
      if (turathToUsulAuthorId[authorId]) {
        linkedAuthor++;
      }
    }
  });

  // write to file
  fs.writeFileSync(
    'scripts/add-turath-books/invalid-books-2.json',
    JSON.stringify(_invalidBooks, null, 2),
  );

  console.log(`- Found ${missingVersions.length} missing versions.`);
  console.log(`- Added ${i} books to invalid books.`);
  console.log(`- Found ${linkedAuthor} books with linked authors.`);

  // console.log(missingVersions);
};

main();
