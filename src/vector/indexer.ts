// import fs from 'fs/promises';
import { indexBook } from './splitters/v1';
import { createIndexIfNotExists } from './vector-store';

const slug = 'sahih';
const versionId = '735';

const main = async () => {
  await createIndexIfNotExists();
  const result = await indexBook({ slug, versionId });

  // await fs.writeFile('book.json', JSON.stringify(result, null, 2));
  console.log('done');
};

main();
