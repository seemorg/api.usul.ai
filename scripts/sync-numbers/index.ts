import { db } from '@/lib/db';
import { chunk } from '@/lib/utils';

const main = async () => {
  const books = await db.book.findMany({
    select: {
      id: true,
      authorId: true,
      genres: { select: { id: true } },
      advancedGenres: { select: { id: true } },
    },
  });

  const authorsToBooksMap: Record<string, number> = {};
  const genresToBooksMap: Record<string, number> = {};
  const advancedGenresToBooksMap: Record<string, number> = {};

  for (const book of books) {
    authorsToBooksMap[book.authorId] = (authorsToBooksMap[book.authorId] || 0) + 1;
    for (const genre of book.genres) {
      genresToBooksMap[genre.id] = (genresToBooksMap[genre.id] || 0) + 1;
    }

    for (const advancedGenre of book.advancedGenres) {
      advancedGenresToBooksMap[advancedGenre.id] =
        (advancedGenresToBooksMap[advancedGenre.id] || 0) + 1;
    }
  }

  // batch updates
  const authorUpdates = chunk(Object.entries(authorsToBooksMap), 50);
  const genreUpdates = chunk(Object.entries(genresToBooksMap), 50);
  const advancedGenreUpdates = chunk(Object.entries(advancedGenresToBooksMap), 50);

  let authorIdx = 0;
  let genreIdx = 0;
  let advancedGenreIdx = 0;

  for (const authorUpdatesBatch of authorUpdates) {
    console.log(`Syncing authors batch ${++authorIdx} / ${authorUpdates.length}`);
    await db.$transaction(
      authorUpdatesBatch.map(([authorId, totalBooks]) =>
        db.author.update({
          where: { id: authorId },
          data: { numberOfBooks: totalBooks },
        }),
      ),
    );
  }

  for (const genreUpdatesBatch of genreUpdates) {
    console.log(`Syncing genres batch ${++genreIdx} / ${genreUpdates.length}`);
    await db.$transaction(
      genreUpdatesBatch.map(([genreId, totalBooks]) =>
        db.genre.update({
          where: { id: genreId },
          data: { numberOfBooks: totalBooks },
        }),
      ),
    );
  }

  for (const advancedGenreUpdatesBatch of advancedGenreUpdates) {
    console.log(
      `Syncing advanced genres batch ${++advancedGenreIdx} / ${
        advancedGenreUpdates.length
      }`,
    );
    await db.$transaction(
      advancedGenreUpdatesBatch.map(([advancedGenreId, totalBooks]) =>
        db.advancedGenre.update({
          where: { id: advancedGenreId },
          data: { numberOfBooks: totalBooks },
        }),
      ),
    );
  }
};

main();
