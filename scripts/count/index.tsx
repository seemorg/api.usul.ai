import { db } from '@/lib/db';

const main = async () => {
  const books = await db.book.findMany({
    select: {
      id: true,
      slug: true,
      versions: true,
    },
    where: {
      numberOfVersions: {
        gte: 1,
      },
    },
  });

  let openitiOnlyCount = 0;
  const sourcesCount: Record<string, { count: number; slugs: string[] }> = {};

  for (const book of books) {
    let openitiOnly = true;

    for (const version of book.versions) {
      if (version.source !== 'openiti') {
        openitiOnly = false;
        break;
      }

      const parts = version.value.split('.');
      const name = parts[parts.length - 1]?.split('-')[0]?.replace('Vols', '');
      if (name) {
        const id = name.replace(/\d+$/, '');
        sourcesCount[id] = {
          count: (sourcesCount[id]?.count || 0) + 1,
          slugs: [...(sourcesCount[id]?.slugs || []), book.slug],
        };
      }
    }

    if (openitiOnly) {
      openitiOnlyCount++;
    }
  }

  console.log(`Openiti only: ${openitiOnlyCount} / ${books.length}`);

  // sort by count
  const sortedSourcesCount = Object.entries(sourcesCount).map(
    ([id, { count, slugs }]) => [
      id,
      {
        count,
        slugs: slugs.slice(0, 3).map(slug => `https://usul.ai/t/${slug}`),
      },
    ],
  );

  console.dir(Object.fromEntries(sortedSourcesCount), { depth: null });
};

main();
