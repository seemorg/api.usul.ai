import { fetchTurathBook, type TurathBookResponse } from './turath';
import { fetchOpenitiBook, type OpenitiBookResponse } from './openiti';

export type ExternalBookResponse = {
  id: string;
  source: 'external';
  url: string;
  publicationDetails: PrismaJson.BookVersion['publicationDetails'];
};

export type PdfBookResponse = {
  id: string;
  source: 'pdf';
  url: string;
  publicationDetails: PrismaJson.BookVersion['publicationDetails'];
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
  }

  if (!version) {
    // if the first 2 versions are turath, use the 2nd one
    // otherwise, just use the first version
    if (allVersions[0]?.source === 'turath' && allVersions[1]?.source === 'turath') {
      version = allVersions[1];
    } else {
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
  };

  if (version.source === 'external') {
    return { ...baseResponse, url: version.value } as FetchBookResponse;
  }

  if (version.source === 'pdf') {
    return { ...baseResponse, url: version.value } as FetchBookResponse;
  }

  if (version.source === 'turath') {
    const turathBook = await fetchTurathBook(version.value);
    return {
      version: version.value,
      ...baseResponse,
      ...turathBook,
    } as TurathBookResponse;
  }

  const openitiBook = await fetchOpenitiBook({
    authorId: record.author!.id,
    bookId: record.id,
    versionId: version.value,
  }).catch(() => null);

  if (!openitiBook) {
    return null;
  }

  return {
    version: version.value,
    ...baseResponse,
    ...openitiBook,
  } as FetchBookResponse;
};
