import { PathLocale } from '@/lib/locale';

declare module '@openiti/markdown-parser' {
  interface Chapter {
    pageIndex?: number;
  }
}

declare global {
  namespace PrismaJson {
    interface BookVersion {
      source: 'openiti' | 'turath' | 'external' | 'pdf';
      value: string;
      publicationDetails?: {
        investigator?: string;
        publisher?: string;
        editionNumber?: string;
        publicationYear?: number; // hijri
      };
    }

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
      splitsData?: { start: number; end: number }[];
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
