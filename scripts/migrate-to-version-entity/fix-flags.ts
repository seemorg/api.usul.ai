import { db } from '@/lib/db';
import flags from './final.json';
import { chunk } from '@/lib/utils';

const main = async () => {
  const books = await db.book.findMany({
    select: {
      id: true,
      versions: true,
    },
  });

  const updates: {
    id: string;
    versions: PrismaJson.BookVersion[];
  }[] = [];

  for (const book of books) {
    for (const version of book.versions) {
      const flag = flags[book.id]?.[version.value];

      if (
        (flag?.ai && !version.aiSupported) ||
        (flag?.keyword && !version.keywordSupported)
      ) {
        updates.push({
          id: book.id,
          versions: book.versions.map(v => ({
            ...v,
            aiSupported: v.aiSupported || !!flags[book.id]?.[v.value]?.ai,
            keywordSupported: v.keywordSupported || !!flags[book.id]?.[v.value]?.keyword,
          })),
        });
      }
    }
  }

  const batches = chunk(updates, 50);

  let i = 0;
  for (const batch of batches) {
    console.log(`Processing batch ${++i} / ${batches.length}`);
    await db.$transaction(
      batch.map(b =>
        db.book.update({
          where: { id: b.id },
          data: { versions: b.versions },
        }),
      ),
    );
  }

  console.log('Done');
};

main();
