import { chunk } from '@/lib/utils';
import { db } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

import oldBooks from '../../backups/books.json';
import { nanoid } from 'nanoid';

const newBooks: any[] = [];

async function main() {
  const batches = chunk(oldBooks as any, 50);
  const startingBatchIndex = 199;

  const batchesToMigrate = batches.slice(startingBatchIndex);

  for (const [index, batch] of batchesToMigrate.entries()) {
    console.log(`🔄 Migrating batch ${index + 1} / ${batchesToMigrate.length}...`);

    try {
      const updatedBooks = await db.$transaction(
        batch.map(book => {
          const flags = book.flags;
          const physicalDetailsString = book.physicalDetails;
          const physicalDetails = book.extraProperties?.physicalDetails;

          const newExtraProperties = structuredClone(book.extraProperties);
          if (newExtraProperties.physicalDetails) {
            newExtraProperties.physicalDetails = undefined;
          }

          return db.book.update({
            where: { id: book.id },
            data: {
              versions: book.versions.map(version => {
                const aiVersion = flags?.aiVersion;
                const keywordVersion = flags?.keywordVersion;

                return {
                  id: nanoid(10),
                  ...version,
                  ...(version.value === aiVersion ? { aiSupported: true } : {}),
                  ...(version.value === keywordVersion ? { keywordSupported: true } : {}),
                };
              }),
              numberOfVersions: book.versions.length,
              extraProperties: newExtraProperties,
              physicalDetails: physicalDetailsString
                ? {
                    ...(physicalDetails ?? { type: 'published' }),
                    ...(physicalDetailsString ? { notes: physicalDetailsString } : {}),
                  }
                : null,
            },
          });
        }),
      );

      newBooks.push(...updatedBooks);
    } catch (error) {
      console.error(error);
      const ids = batch.map(book => book.id);
      const booksForError = await db.book.findMany({
        where: { id: { in: ids } },
      });

      // log the ids not found
      console.log(
        ids.filter(id => !booksForError.find(book => book.id === id)).join(', '),
      );
      return;
    }
  }

  await fs.writeFile(
    path.resolve('../../backups', 'new-books.json'),
    JSON.stringify(newBooks, null, 2),
  );
}

main();
