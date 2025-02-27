import { getBookById } from '@/services/book';
import { localeSchema } from '@/validators/locale';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

const sections = {
  popular: [
    { id: '0256Bukhari.Sahih' },
    { id: '0261Muslim.Sahih' },
    { id: '0275AbuDawudSijistani.Sunan' },
    { id: '0273IbnMaja.Sunan' },
    { id: '0303Nasai.SunanSughra' },
    { id: '1420MuhammadNasirDinAlbani.SahihWaDacifSunanTirmidhi' },
    { id: '0179MalikIbnAnas.Muwatta' },
    { id: '0676Nawawi.RiyadSalihin' },
    { id: '0505Ghazali.IhyaCulumDin' },
    { id: '0911Suyuti.TafsirJalalayn' },
    { id: '0774IbnKathir.TafsirQuran' },
    { id: '0852IbnHajarCasqalani.FathBari' },
  ],
  'islamic-law': [
    { id: '0179MalikIbnAnas.Muwatta' },
    { id: '0620IbnQudamaMaqdisi.Mughni' },
    { id: '0593BurhanDinFarghaniMarghinani.HidayaFiSharhBidaya' },
    { id: '0595IbnRushdHafid.BidayatMujtahid' },
    { id: '0204Shafici.Umm' },
    { id: '0428AbuHusaynQuduri.Mukhtasar' },
    { id: '0204Shafici.Risala' },
    { id: '0695IbnAbiJamra.MukhtasarSahihBukhari' },
    { id: '0483IbnAhmadSarakhsi.Mabsut' },
    { id: '1252IbnCabidinDimashqi.RaddMuhtar' },
    { id: '0456IbnHazm.MuhallaBiAthar' },
  ],
  'islamic-history': [
    { id: '0213IbnHisham.SiraNabawiyya' },
    { id: '0151IbnIshaq.Sira' },
    { id: '0751IbnQayyimJawziyya.ZadMacad' },
    { id: '0774IbnKathir.Bidaya' },
    { id: '0310Tabari.Tarikh' },
    { id: '0241IbnHanbal.FadailSahaba' },
    { id: '0354IbnHibbanBusti.Sira' },
    { id: '0303Nasai.Wafat' },
    { id: '0456IbnHazm.JawamicSira' },
    { id: '0774IbnKathir.QisasAnbiya' },
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

    const ids = sections[section as keyof typeof sections];

    const books = await Promise.all(ids.map(({ id }) => getBookById(id, locale)));

    return c.json(books);
  },
);

export default homepageSectionsRoutes;
