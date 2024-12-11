import type { ParseMetaData } from '@openiti/markdown-parser';

const filterEmpty = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  if (value.toLowerCase() === 'nodata') {
    return undefined;
  }

  return value;
};

export const getOpenitiPublicationDetails = (metadata: ParseMetaData) => {
  const publicationDetails: PrismaJson.PublicationDetails = {
    investigator: filterEmpty(metadata.EdEDITOR),
    publisher: filterEmpty(metadata.EdPUBLISHER),
    publisherLocation: filterEmpty(metadata.EdPLACE),
    editionNumber: filterEmpty(metadata.EdNUMBER),
    publicationYear: filterEmpty(metadata.EdYEAR),
  };

  return publicationDetails;
};
