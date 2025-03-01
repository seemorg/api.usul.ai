import { fetchTurathBook, type TurathBookResponse } from './turath';
import { fetchOpenitiBook, type OpenitiBookResponse } from './openiti';
import _uploadedVersions from './uploaded-versions.json';

const uploadedVersions = _uploadedVersions as Record<string, boolean>;

export type ExternalBookResponse = {
  id: string;
  source: 'external';
  url: string;
  publicationDetails: PrismaJson.BookVersion['publicationDetails'];
};

export type PdfBookResponse =
  | {
      id: string;
      source: 'pdf';
      url: string;
      publicationDetails: PrismaJson.BookVersion['publicationDetails'];
    }
  | {
      id: string;
      source: 'pdf';
      publicationDetails: PrismaJson.BookVersion['publicationDetails'];
      url: string;
      pages: {
        volume: number | null;
        page: number | null;
        content: string | null;
        footnotes: string | null;
        editorialNotes: string | null;
      }[];
      headings: {
        title: string;
        level: number;
        page: {
          volume: number | null;
          page: number | null;
        };
        pageIndex: number;
      }[];
    };

export type FetchBookResponse =
  | TurathBookResponse
  | OpenitiBookResponse
  | ExternalBookResponse
  | PdfBookResponse;

export type FetchBookResponseOfType<T extends FetchBookResponse['source']> = Extract<
  FetchBookResponse,
  { source: T }
>;

export const fetchBookContent = async (
  record: { versions: PrismaJson.BookVersion[]; id: string; author: { id: string } },
  versionId?: string,
): Promise<FetchBookResponse | null> => {
  const allVersions = record.versions;

  let version: PrismaJson.BookVersion | undefined;
  if (versionId) {
    version = allVersions.find(v => v.id === versionId);
    if (!version) {
      return null;
    }
  } else {
    // if no version is specified, use the first one that supports ai
    // if no version supports ai, use the first one that supports turath
    // if no version supports turath, use the first one
    version = allVersions.find(v => v.aiSupported);
    if (!version) {
      version = allVersions.find(v => v.source === 'turath');
    }
    if (!version) {
      version = allVersions[0];
    }
  }

  if (!version) {
    return null;
  }

  const baseResponse = {
    id: version.id,
    source: version.source,
    publicationDetails: version.publicationDetails,
    aiSupported: version.aiSupported,
    keywordSupported: version.keywordSupported,
  };

  if (version.source === 'external') {
    return { ...baseResponse, url: version.value } as FetchBookResponse;
  }

  if (version.source === 'pdf') {
    if (version.ocrBookId) {
      const key = `book-content/ocr/${version.ocrBookId}.json`;
      if (uploadedVersions[key]) {
        const ocrBook = await (await fetch(`https://assets.usul.ai/${key}`)).json();
        return {
          ...baseResponse,
          url: version.value,
          ...ocrBook,
        } as FetchBookResponse;
      }
    }

    return { ...baseResponse, url: version.value } as FetchBookResponse;
  }

  const key = `book-content/${version.source}/${version.value}.json`;

  if (version.source === 'turath') {
    const turathBook = uploadedVersions[key]
      ? await (await fetch(`https://assets.usul.ai/${key}`)).json()
      : await fetchTurathBook(version.value);

    return {
      ...baseResponse,
      ...turathBook,
      version: version.value,
      pdfUrl: version.pdfUrl,
      sourcePdf: turathBook.sourcePdf,
      sourcePublicationDetails: turathBook.sourcePublicationDetails,
    } as TurathBookResponse;
  }

  const openitiBook = uploadedVersions[key]
    ? await (await fetch(`https://assets.usul.ai/${key}`)).json()
    : await fetchOpenitiBook({
        authorId: record.author!.id,
        bookId: record.id,
        version: version.value,
      }).catch(() => null);

  if (!openitiBook) {
    return null;
  }

  return {
    ...baseResponse,
    ...openitiBook,
    version: version.value,
    pdfUrl: version.pdfUrl,
    sourcePublicationDetails: openitiBook.sourcePublicationDetails,
  } as FetchBookResponse;
};
