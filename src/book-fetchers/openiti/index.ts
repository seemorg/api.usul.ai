import { parseMarkdown, type ContentItem } from '@openiti/markdown-parser';
import { getOpenitiPublicationDetails } from './utils';
import { chunk } from '@/lib/utils';

const prepareContent = (content: ContentItem[]): ContentItem[] => {
  const newItems: ContentItem[] = [];

  for (const item of content) {
    if (item.blocks.length === 0) {
      continue;
    }

    newItems.push(item);
  }

  return newItems;
};

export const fetchOpenitiBook = async ({
  authorId,
  bookId,
  version,
}: {
  authorId: string;
  bookId: string;
  version: string;
}) => {
  const baseUrl = `https://raw.githubusercontent.com/OpenITI/RELEASE/2385733573ab800b5aea09bc846b1d864f475476/data/${authorId}/${bookId}/${version}`;
  let finalUrl = baseUrl;

  const options: RequestInit = {
    cache: 'no-store',
  };
  let response = await fetch(baseUrl, options);

  if (!response.ok || response.status >= 300) {
    finalUrl = `${baseUrl}.completed`;
    response = await fetch(finalUrl, options);

    if (!response.ok || response.status >= 300) {
      finalUrl = `${baseUrl}.mARkdown`;
      response = await fetch(finalUrl, options);

      if (!response.ok || response.status >= 300) {
        throw new Error('Book not found');
      }
    }
  }

  const text = await response.text();
  const final = parseMarkdown(text);

  // filter out empty blocks
  final.content = prepareContent(final.content);

  const volAndPageToIndex = final.content.reduce((acc, cur, idx) => {
    acc[`${cur.volume ?? ''}-${cur.page}`] = idx;
    return acc;
  }, {} as Record<string, number>);

  final.chapters = final.chapters.map(chapter => {
    if (chapter.page) {
      (chapter as any).pageIndex =
        volAndPageToIndex[`${chapter.volume ?? ''}-${chapter.page}` as string] ?? -1;
    }
    return chapter;
  });

  if (final.content.length === 1) {
    // the book is not split into pages, we need to split it into pages
    const finalContent = chunk(final.content[0].blocks, 10);
    final.content = finalContent.map(blocks => ({
      page: final.content[0].page,
      volume: final.content[0].volume,
      blocks,
    }));
  }

  // TODO: uncomment to get this info from their api and not our DB
  const publicationDetails = getOpenitiPublicationDetails(final.metadata);

  return {
    ...final,
    sourcePublicationDetails: publicationDetails,
  };
};

export type OpenitiBookResponse = {
  id: string;
  source: 'openiti';
  version: string;
  pdfUrl?: string;
  publicationDetails?: PrismaJson.PublicationDetails;
  sourcePublicationDetails?: PrismaJson.PublicationDetails;
} & Awaited<ReturnType<typeof fetchOpenitiBook>>;
