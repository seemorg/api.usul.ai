export const locales = [
  { code: 'en-US', name: 'English' },
  { code: 'ar-SA', name: 'Arabic' },
  { code: 'bn-BD', name: 'Bengali' },
  { code: 'fr-FR', name: 'French' },
  { code: 'hi-IN', name: 'Hindi' },
  { code: 'ha-NG', name: 'Hausa' },
  { code: 'ms-MY', name: 'Malay' },
  { code: 'ps-AF', name: 'Pashto' },
  { code: 'fa-IR', name: 'Persian' },
  { code: 'ru-RU', name: 'Russian' },
  { code: 'so-SO', name: 'Somali' },
  { code: 'es-ES', name: 'Spanish' },
  { code: 'tr-TR', name: 'Turkish' },
  { code: 'ur-PK', name: 'Urdu' },
] as const;

export type AppLocale = (typeof locales)[number]['code'];

const pathLocaleToSupportedBcp47LocaleMap = {
  en: 'en-US',
  ar: 'ar-SA',
  bn: 'bn-BD',
  fr: 'fr-FR',
  hi: 'hi-IN',
  ha: 'ha-NG',
  ms: 'ms-MY',
  ps: 'ps-AF',
  fa: 'fa-IR',
  ru: 'ru-RU',
  so: 'so-SO',
  es: 'es-ES',
  tr: 'tr-TR',
  ur: 'ur-PK',
} as const satisfies Record<string, AppLocale>;

export const PATH_LOCALES = Object.keys(
  pathLocaleToSupportedBcp47LocaleMap,
) as (keyof typeof pathLocaleToSupportedBcp47LocaleMap)[];

export type PathLocale = (typeof PATH_LOCALES)[number];
