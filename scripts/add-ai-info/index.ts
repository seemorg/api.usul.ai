import { db } from '@/lib/db';
import { chunk } from '@/lib/utils';
import { booksQueue } from '@/queues/ai-indexer/queue';
import { keywordIndexerQueue } from '@/queues/keyword-indexer/queue';

const main = async () => {
  const aiVersions = (await booksQueue.getCompleted(0, 10_000)).map(v => v.data);
  const keywordVersions = (await keywordIndexerQueue.getCompleted(0, 10_000)).map(
    v => v.data,
  );

  const final: Record<string, { aiVersionId?: string; keywordVersionId?: string }> = {};

  for (const aiVersion of aiVersions) {
    final[aiVersion.id] = { aiVersionId: aiVersion.versionId };
  }

  for (const keywordVersion of keywordVersions) {
    if (final[keywordVersion.id]) {
      final[keywordVersion.id].keywordVersionId = keywordVersion.versionId;
    } else {
      final[keywordVersion.id] = { keywordVersionId: keywordVersion.versionId };
    }
  }

  // update all versions and toggle ai field
  const batches = chunk(Object.entries(final), 50);

  let i = 0;
  for (const batch of batches) {
    console.log(`Processing batch ${++i} / ${batches.length}`);

    const aiVersionValues = batch.map(v => v[1]?.aiVersionId).filter(Boolean) as string[];
    const keywordVersionValues = batch
      .map(v => v[1]?.keywordVersionId)
      .filter(Boolean) as string[];

    const books = await db.book.findMany({
      where: {
        id: { in: batch.map(v => v[0]) },
      },
      select: { id: true, versions: true },
    });

    await db.$transaction(
      books.map(book =>
        db.book.update({
          where: { id: book.id },
          data: {
            versions: book.versions.map(v => ({
              ...v,
              aiSupported: aiVersionValues.includes(v.value),
              keywordSupported: keywordVersionValues.includes(v.value),
            })),
          },
        }),
      ),
    );
  }
};

main();
