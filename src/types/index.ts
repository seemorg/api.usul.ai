import { PathLocale } from '@/lib/locale';

declare global {
  namespace PrismaJson {
    type BookVersion = {
      source: 'openiti' | 'turath' | 'external';
      value: string;
    };

    type BookFlags = {
      aiSupported?: boolean;
    };
  }
}

declare module 'hono' {
  interface ContextVariableMap {
    locale: PathLocale;
  }
}

export {};
