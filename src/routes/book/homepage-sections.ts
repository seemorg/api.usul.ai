import { getBookBySlug } from '@/services/book';
import { localeSchema } from '@/validators/locale';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

const sections = {
  popular: [
    'sahih',
    'sahih-1',
    'sunan-4',
    'sunan-3',
    'sahih-wa-dacif-sunan-tirmidhi',
    'sunan-sughra',
    'muwatta',
    'riyad-salihin',
    'ihya-culum-din',
    'tafsir-jalalayn',
    'tafsir-quran-6',
    'fath-bari',
  ],
  'islamic-law': [
    'muwatta',
    'mughni',
    'hidaya-fi-sharh-bidaya',
    'bidayat-mujtahid',
    'umm',
    'mukhtasar-4',
    'risala',
    'mukhtasar-sahih-bukhari',
    'mabsut-1',
    'radd-muhtar',
    'muhalla-bi-athar',
  ],
  'islamic-history': [
    'sira-nabawiyya',
    'sira',
    'zad-macad',
    'bidaya-1',
    'tarikh-5',
    'fadail-sahaba',
    'sira-1',
    'wafat',
    'jawamic-sira',
    'qisas-anbiya-1',
  ],
};

const homepageSectionsRoutes = new Hono();

homepageSectionsRoutes.get(
  '/sections/:section',
  zValidator(
    'param',
    z.object({ section: z.enum(Object.keys(sections) as [string, ...string[]]) }),
  ),
  zValidator(
    'query',
    z.object({
      locale: localeSchema,
    }),
  ),
  async c => {
    const { section } = c.req.valid('param');
    const { locale } = c.req.valid('query');

    const slugs = sections[section as keyof typeof sections];

    const books = await Promise.all(slugs.map(slug => getBookBySlug(slug, locale)));

    return c.json(books);
  },
);

export default homepageSectionsRoutes;
