import { PathLocale } from '@/lib/locale';

declare module '@openiti/markdown-parser' {
  interface Chapter {
    pageIndex?: number;
  }
}

interface PublicationDetails {
  investigator?: string;
  publisher?: string;
  publisherLocation?: string;
  editionNumber?: string;
  publicationYear?: number; // hijri
}

type SplitsData = { start: number; end: number }[];

declare global {
  namespace PrismaJson {
    type BookVersion =
      | {
          source: 'openiti' | 'turath' | 'external';
          value: string;
          publicationDetails?: PublicationDetails;
        }
      | {
          source: 'pdf';
          value: string;
          publicationDetails?: PublicationDetails;
          ocrBookId?: string;
          splitsData?: SplitsData;
        };

    interface BookFlags {
      aiSupported?: boolean;
      aiVersion?: string;

      keywordSupported?: boolean;
      keywordVersion?: string;
    }

    interface AuthorExtraProperties {
      _airtableReference?: string;
    }

    interface BookExtraProperties {
      physicalDetails?:
        | {
            type: 'published';
            investigator?: string;
            publisher?: string;
            publisherLocation?: string;
            editionNumber?: string;
            publicationYear?: number; // hijri
          }
        | {
            type: 'manuscript';
          };
      splitsData?: SplitsData;
      _airtableReference?: string;
    }

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
