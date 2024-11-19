import { fetchBookContent } from '@/book-fetchers';
import { getBookBySlug } from '@/services/book';
import fs from 'fs/promises';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { prepareBookForChunking } from './prepare';
import { splitBookIntoChunks } from './chunking';

const locale = 'en';
const slug = 'sahih';
const versionId = '735';

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 50,
  separators: [''],
});

const main = async () => {
  const book = await getBookBySlug(slug, locale);
  if (!book) {
    return;
  }

  const bookContent = await fetchBookContent(book, versionId);
  if (!bookContent || bookContent.source === 'external') {
    return;
  }

  const preparedBook = prepareBookForChunking(bookContent);
  if (!preparedBook) {
    return;
  }

  // APPROACH 1: Langchain
  // const documents = preparedBook?.map(
  //   ({ text, ...metadata }) => new Document({ pageContent: text, metadata }),
  // );
  // const chunks = await splitter.splitDocuments(documents);

  // APPROACH 2: Custom
  const chunks = splitBookIntoChunks(
    preparedBook,
    bookContent.source === 'turath'
      ? bookContent.turathResponse.headings
      : bookContent.chapters,
  );

  await fs.writeFile('book.json', JSON.stringify(chunks, null, 2));
  console.log('done');
};

main();
