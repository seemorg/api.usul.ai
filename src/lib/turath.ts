import type { TurathApiBookResponse } from '@/types/turath';
import { bytesToMB } from './utils';

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

export const getTurathPdfDetails = (pdf: TurathApiBookResponse['meta']['pdf_links']) => {
  let root = pdf?.root ? pdf.root.replace(/\/$/, '') : null;
  let file = pdf?.files[0];
  if ((pdf?.files?.length ?? 0) > 1) {
    const completeFile = pdf!.files?.find(e => e.endsWith('|0'));
    if (completeFile) {
      file = completeFile.split('|')[0];
    }
  }

  let finalUrl: string | undefined;
  if (file) {
    let url = `https://files.turath.io/pdf/`;

    if (root) {
      if (root.includes('archive.org')) {
        root = 'archive/' + root.replace('https://archive.org/download/', '');
        url += `${root}_=_${file}`;
      } else {
        url += `${root}/${file}`;
      }
    }

    finalUrl = encodeURI(url);
  }

  return {
    finalUrl,
    sizeInMb: pdf?.size ? bytesToMB(pdf.size) : undefined,
  };
};

export const getTurathPublicationDetails = (info: string) => {
  const publicationDetails: PublicationDetails = {};

  info.split('\n').forEach(line => {
    if (line === '[ترقيم الكتاب موافق للمطبوع]') {
      publicationDetails.pageNumbersMatchPrint = true;
      return;
    }

    const [key, value] = line.split(':');
    if (!key || !value) return;

    const trimmedKey = key.trim();
    let newKey: keyof Omit<PublicationDetails, 'pageNumbersMatchPrint'> | null = null;
    if (trimmedKey === 'الكتاب') {
      newKey = 'title';
    } else if (trimmedKey === 'المؤلف') {
      newKey = 'author';
    } else if (trimmedKey === 'المحقق') {
      newKey = 'editor';
    } else if (trimmedKey === 'الناشر') {
      newKey = 'publisher';
    } else if (trimmedKey === 'الطبعة') {
      newKey = 'printVersion';
    } else if (trimmedKey === 'عدد الأجزاء') {
      newKey = 'volumes';
    }

    if (newKey) {
      publicationDetails[newKey] = value.trim();
    }
  });

  return publicationDetails;
};
