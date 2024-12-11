import { bytesToMB } from '@/lib/utils';
import { TurathApiBookResponse } from '@/types/turath';

const bookKeysMap = `
meta id name type printed pdf_links info info_long version \
author_id cat_id date_built author_page_start indexes volumes \
headings print_pg_to_pg volume_bounds page_map page_headings non_author
`
  .trim()
  .split(' ');

const unObfuscateKeys = (s: string) =>
  s.replace(/"([ً-ٟ])":/g, (m, m1) => `"${bookKeysMap[m1.charCodeAt(0) - 0x064b]}":`);

export const fetchTurathBookById = async (id: number | string) => {
  const text = await (
    await fetch(`https://files.turath.io/books-v3/${id}.json`, {
      cache: 'no-store',
    })
  ).text();

  return JSON.parse(unObfuscateKeys(text)) as TurathApiBookResponse;
};

const prepareTurathPdfUrl = (
  pdf: NonNullable<TurathApiBookResponse['meta']['pdf_links']>,
  url: string,
) => {
  let finalUrl = url.split('|')[0];

  if (pdf.root) {
    finalUrl = pdf.root.replace(/\/$/, '') + '/' + finalUrl;
  }

  if (finalUrl.includes('archive.org')) {
    finalUrl =
      'archive/' +
      finalUrl.replace('https://archive.org/download/', '').replace(/\//, '_=_');
  }

  return `https://files.turath.io/pdf/${finalUrl}`;
};

export const getTurathPdfDetails = (response: TurathApiBookResponse) => {
  const pdf = response.meta.pdf_links;
  const volumes = response.indexes.volumes;

  if (!pdf || pdf.files.length === 0) return null;

  const fullBookUrl = pdf.files.find(e => e.endsWith('|0')); // full book
  if (fullBookUrl) {
    return {
      fullBookUrl: prepareTurathPdfUrl(pdf, fullBookUrl),
      sizeInMb: pdf?.size ? bytesToMB(pdf.size) : undefined,
    };
  }

  if (pdf.files.length === 1) {
    return {
      fullBookUrl: prepareTurathPdfUrl(pdf, pdf.files[0]),
      sizeInMb: pdf?.size ? bytesToMB(pdf.size) : undefined,
    };
  }

  const entries = Object.fromEntries(
    pdf.files.map(e => {
      const key = e.includes('|') ? e.split('|')[1] : e.match(/0*(\d+)/)?.[1];
      return [key!, e];
    }),
  ); // volume to file name

  // const volumes = Object.keys(entries);
  if (volumes.length === 0) return null;

  const volumeToUrl = volumes.map(volume => {
    if (!entries[volume]) return null;

    const url = prepareTurathPdfUrl(pdf, entries[volume]);
    return {
      volume,
      url,
    };
  });

  const withoutNulls = volumeToUrl.filter(e => e !== null);

  // return the entries directly
  if (withoutNulls.length === 0) {
    return Object.values(entries).map(e => ({
      volume: e,
      url: prepareTurathPdfUrl(pdf, e),
    }));
  }

  if (withoutNulls.length !== volumeToUrl.length) {
    throw new Error(`Volume to url mapping failed for book ${response.meta.id}`);
  }

  return volumeToUrl;
};

const splitAndTrim = (s: string, separator: string) => {
  const parts = s.split(separator).map(e => e.trim());
  return [parts.slice(0, -1).join(separator), parts[parts.length - 1]];
};

export const getTurathPublicationDetails = (response: TurathApiBookResponse) => {
  const info = response.meta.info;
  const publicationDetails: PrismaJson.PublicationDetails = {};

  info.split('\n').forEach(line => {
    // if (line === '[ترقيم الكتاب موافق للمطبوع]') {
    //   publicationDetails.pageNumbersMatchPrint = true;
    //   return;
    // }

    const [key, value] = line.split(':');
    if (!key || !value) return;

    const trimmedKey = key.trim();
    const trimmedValue = value.trim();

    let newKey: keyof PrismaJson.PublicationDetails | null = null;
    let newValue: string | null = null;

    if (
      trimmedKey.includes('محقق') ||
      trimmedKey.includes('حقق') ||
      trimmedKey.includes('تحقيق')
    ) {
      newKey = 'investigator';
    } else if (trimmedKey === 'الناشر') {
      newKey = 'publisher';
      if (trimmedValue.includes('،')) {
        const [publisher, publisherLocation] = splitAndTrim(trimmedValue, '،');
        newValue = publisher;
        publicationDetails.publisherLocation = publisherLocation;
      } else if (trimmedValue.includes('-')) {
        const [publisher, publisherLocation] = splitAndTrim(trimmedValue, '-');
        newValue = publisher;
        publicationDetails.publisherLocation = publisherLocation;
      }
    } else if (trimmedKey === 'الطبعة') {
      newKey = 'editionNumber';

      if (trimmedValue.includes('،')) {
        const [editionNumber, publicationYear] = splitAndTrim(trimmedValue, '،');
        newValue = editionNumber;
        publicationDetails.publicationYear = publicationYear;
      } else if (trimmedValue.includes('-')) {
        const [editionNumber, publicationYear] = splitAndTrim(trimmedValue, '-');
        newValue = editionNumber;
        publicationDetails.publicationYear = publicationYear;
      }
    }

    if (!newValue) {
      newValue = trimmedValue;
    }

    if (newKey) {
      publicationDetails[newKey] = newValue;
    }
  });

  return publicationDetails;
};
