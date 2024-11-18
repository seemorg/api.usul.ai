import { fetchBookContent } from '@/book-fetchers';
import { getBookBySlug } from '@/services/book';
import { prepareBook, splitBookIntoChunks } from './tokenization';
import fs from 'fs/promises';
// import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
// import { Document } from '@langchain/core/documents';

const locale = 'en';
const slug = 'sahih';
const versionId = '735';

// const splitter = new RecursiveCharacterTextSplitter({
//   chunkSize: 500,
//   chunkOverlap: 50,
//   separators: [''],
// });

const main = async () => {
  const book = await getBookBySlug(slug, locale);
  if (!book) {
    return;
  }

  const bookContent = await fetchBookContent(book, versionId);
  if (!bookContent) {
    return;
  }

  const preparedBook = prepareBook(bookContent);
  if (!preparedBook) {
    return;
  }

  // const documents = preparedBook?.map(
  //   ({ preparedText, formattedText, ...metadata }) =>
  //     new Document({ pageContent: formattedText, metadata }),
  // );

  // const chunks = await splitter.splitDocuments(documents);
  const chunks = splitBookIntoChunks(bookContent);

  await fs.writeFile('chunks-2.json', JSON.stringify(chunks, null, 2));
  console.log('done');
};

main();
