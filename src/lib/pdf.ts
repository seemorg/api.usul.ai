import { PDFDocument } from '@cantoo/pdf-lib';

export const loadPdf = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch PDF');
  }

  const arrayBuffer = await response.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer, {
    ignoreEncryption: true,
    password: '',
  });

  return pdf;
};

export const mergePdfs = async (pdfs: PDFDocument[]) => {
  const mergedPdf = await PDFDocument.create();
  for (const pdf of pdfs) {
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach(page => {
      mergedPdf.addPage(page);
    });
  }

  return mergedPdf;
};
