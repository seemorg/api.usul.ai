const locales = [
  'en-US', // english
  'ar-SA', // arabic
  'bn-BD', // bengali
  'fr-FR', // french
  'hi-IN', // hindi
  'ha-NG', // hausa
  'ms-MY', // malay
  'ps-AF', // pashto
  'fa-IR', // persian
  'ru-RU', // russian
  'so-SO', // somali
  'es-ES', // spanish
  'tr-TR', // turkish
  'ur-PK', // urdu
] as const;

type AppLocale = (typeof locales)[number];

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
