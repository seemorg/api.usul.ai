import invalidBooks from './invalid-books-2.json';
import message from './message.json';
import fs from 'fs';

const merged = Object.entries(invalidBooks).map(([authorId, author]) => {
  const currentAuthor = message[authorId];

  if (currentAuthor) {
    return {
      ...currentAuthor,
      books: author.books.map(book => {
        const currentBook = currentAuthor.books.find(b => b.turathId === book.turathId);
        if (!currentBook) {
          console.log(book.arabicName);
        }
        return currentBook || book;
      }),
    };
  }

  return author;
});

fs.writeFileSync(
  'scripts/add-turath-books/merge/merged.json',
  JSON.stringify(merged, null, 2),
);
