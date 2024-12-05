import { db } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

const backupDir = path.resolve('../../backups');

async function ensureDir(name: string) {
  const dir = path.resolve(name);
  await fs.mkdir(dir, { recursive: true });
}

const LIMIT = 200;

async function main() {
  console.log('🔄 Fetching books...');

  const allBooks: any[] = [];
  let cursor: string | undefined;
  let hasMore = true;
  let i = 0;
  do {
    console.log(`🔄 Fetching books ${i + 1}...`);

    const books = await db.book.findMany({
      take: LIMIT,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
    });
    allBooks.push(...books);
    cursor = books[books.length - 1].id;
    hasMore = books.length === LIMIT;
    i++;
  } while (hasMore);

  await ensureDir(backupDir);
  await fs.writeFile(
    path.resolve(backupDir, 'books.json'),
    JSON.stringify(allBooks, null, 2),
  );

  console.log('Done!');
}

main();
