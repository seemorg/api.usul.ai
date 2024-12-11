import { PathLocale } from '@/lib/locale';

declare module '@openiti/markdown-parser' {
  interface Chapter {
    pageIndex?: number;
  }
}

interface _PublicationDetails {
  investigator?: string;
  publisher?: string;
  publisherLocation?: string;
  editionNumber?: string;
  publicationYear?: string; // hijri
}

type SplitsData = { start: number; end: number }[];

declare global {
  namespace PrismaJson {
    type PublicationDetails = _PublicationDetails;

    type BookVersion = {
      id: string;
      value: string;
      publicationDetails?: PublicationDetails;
      aiSupported?: boolean;
      keywordSupported?: boolean;
    } & (
      | {
          source: 'turath' | 'openiti';
          pdfUrl?: string;
        }
      | {
          source: 'external';
        }
      | {
          source: 'pdf';
          ocrBookId?: string;
          splitsData?: SplitsData;
        }
    );

    interface AuthorExtraProperties {
      _airtableReference?: string;
    }

    interface BookExtraProperties {
      _airtableReference?: string;
    }

    type BookPhysicalDetails = (
      | {
          type: 'manuscript';
        }
      | ({
          type: 'published';
        } & PublicationDetails)
    ) & {
      notes?: string;
    };

    interface GenreExtraProperties {
      _airtableReference?: string;
    }

    interface AdvancedGenreExtraProperties {
      _airtableReference?: string;
      simpleGenreId?: string; // id in Genres table
    }
  }
}

declare module 'hono' {
  interface ContextVariableMap {
    locale: PathLocale;
  }
}

export {};
