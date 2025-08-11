import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

type UnknownRecord = Record<string, any>;

const readJson = <T = any>(filepath: string): T => {
  const content = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(content) as T;
};

const fileExists = (p: string) => fs.existsSync(p);

const resolveCacheFile = (filename: string) => {
  // Prefer ./cache as requested, fallback to ./.cache used by services
  const primary = path.resolve('cache', filename);
  if (fileExists(primary)) return primary;
  const fallback = path.resolve('.cache', filename);
  if (fileExists(fallback)) return fallback;
  throw new Error(`Cache file not found: ./cache/${filename} or ./.cache/${filename}`);
};

const chunk = <T>(arr: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
};

async function seedRegions() {
  const file = resolveCacheFile('regions.json');
  const regions = readJson<UnknownRecord[]>(file);

  const base = regions.map(r => ({
    id: r.id,
    slug: r.slug,
    transliteration: r.transliteration ?? null,
    currentNameTransliteration: r.currentNameTransliteration ?? null,
    numberOfAuthors: r.numberOfAuthors ?? 0,
    numberOfBooks: r.numberOfBooks ?? 0,
  }));

  if (base.length) {
    await db.region.createMany({ data: base, skipDuplicates: true });
  }

  const names = regions.flatMap(r =>
    (r.nameTranslations ?? []).map((t: any) => ({
      regionId: r.id,
      locale: t.locale,
      text: t.text,
    })),
  );
  if (names.length) await db.regionName.createMany({ data: names, skipDuplicates: true });

  const currentNames = regions.flatMap(r =>
    (r.currentNameTranslations ?? []).map((t: any) => ({
      regionId: r.id,
      locale: t.locale,
      text: t.text,
    })),
  );
  if (currentNames.length)
    await db.regionCurrentName.createMany({ data: currentNames, skipDuplicates: true });

  const overviews = regions.flatMap(r =>
    (r.overviewTranslations ?? []).map((t: any) => ({
      regionId: r.id,
      locale: t.locale,
      text: t.text,
    })),
  );
  if (overviews.length)
    await db.regionOverview.createMany({ data: overviews, skipDuplicates: true });

  console.log(`Seeded regions: ${base.length}`);
}

async function seedLocations() {
  const file = resolveCacheFile('locations.json');
  const locations = readJson<UnknownRecord[]>(file);

  const base = locations.map(l => ({
    id: l.id,
    slug: l.slug,
    name: l.name,
    type: l.type,
    transliteration: l.transliteration ?? null,
    regionId: l.regionId ?? null,
  }));
  if (base.length) await db.location.createMany({ data: base, skipDuplicates: true });

  const cityNames = locations.flatMap(l =>
    (l.cityNameTranslations ?? []).map((t: any) => ({
      locationId: l.id,
      locale: t.locale,
      text: t.text,
    })),
  );
  if (cityNames.length)
    await db.locationCityName.createMany({ data: cityNames, skipDuplicates: true });

  console.log(`Seeded locations: ${base.length}`);
}

async function seedAuthors() {
  const file = resolveCacheFile('authors.json');
  const authors = readJson<UnknownRecord[]>(file);

  const base = authors.map(a => ({
    id: a.id,
    slug: a.slug,
    transliteration: a.transliteration ?? null,
    otherNameTransliterations: a.otherNameTransliterations ?? [],
    year: a.year ?? null,
    yearStatus: a.yearStatus ?? null,
    numberOfBooks: a.numberOfBooks ?? 0,
    extraProperties: a.extraProperties ?? {},
  }));
  if (base.length) await db.author.createMany({ data: base, skipDuplicates: true });

  const primaryNames = authors.flatMap(a =>
    (a.primaryNameTranslations ?? []).map((t: any) => ({
      authorId: a.id,
      locale: t.locale,
      text: t.text,
    })),
  );
  if (primaryNames.length)
    await db.authorPrimaryName.createMany({ data: primaryNames, skipDuplicates: true });

  const otherNames = authors.flatMap(a =>
    (a.otherNameTranslations ?? []).map((t: any) => ({
      authorId: a.id,
      locale: t.locale,
      texts: t.texts ?? [],
    })),
  );
  if (otherNames.length)
    await db.authorOtherNames.createMany({ data: otherNames, skipDuplicates: true });

  const bios = authors.flatMap(a =>
    (a.bioTranslations ?? []).map((t: any) => ({
      authorId: a.id,
      locale: t.locale,
      text: t.text,
    })),
  );
  if (bios.length) await db.authorBio.createMany({ data: bios, skipDuplicates: true });

  // Connect author <-> locations many-to-many
  const authorsWithLocations = authors
    .map(a => ({ id: a.id, locationIds: (a.locations ?? []).map((l: any) => l.id) }))
    .filter(a => a.locationIds.length > 0);

  // process in chunks to avoid overwhelming the DB
  for (const group of chunk(authorsWithLocations, 50)) {
    await Promise.all(
      group.map(a =>
        db.author.update({
          where: { id: a.id },
          data: { locations: { set: [], connect: a.locationIds.map(id => ({ id })) } },
        }),
      ),
    );
  }

  console.log(
    `Seeded authors: ${base.length} (with ${authorsWithLocations.length} location relations)`,
  );
}

async function seedGenres() {
  const file = resolveCacheFile('genres.json');
  const genres = readJson<UnknownRecord[]>(file);

  const base = genres.map(g => ({
    id: g.id,
    slug: g.slug,
    transliteration: g.transliteration ?? null,
    extraProperties: g.extraProperties ?? {},
    numberOfBooks: g.numberOfBooks ?? 0,
  }));
  if (base.length) await db.genre.createMany({ data: base, skipDuplicates: true });

  const names = genres.flatMap(g =>
    (g.nameTranslations ?? []).map((t: any) => ({
      genreId: g.id,
      locale: t.locale,
      text: t.text,
    })),
  );
  if (names.length) await db.genreName.createMany({ data: names, skipDuplicates: true });

  console.log(`Seeded genres: ${base.length}`);
}

async function seedBooks() {
  const file = resolveCacheFile('books.json');
  const books = readJson<UnknownRecord[]>(file);

  const base = books.map(b => ({
    id: b.id,
    slug: b.slug,
    transliteration: b.transliteration ?? null,
    otherNameTransliterations: b.otherNameTransliterations ?? [],
    versions: b.versions ?? [],
    numberOfVersions: b.numberOfVersions ?? 0,
    extraProperties: b.extraProperties ?? {},
    physicalDetails: b.physicalDetails ?? null,
    authorId: b.authorId,
    coverImageUrl: b.coverImageUrl ?? null,
  }));
  if (base.length) await db.book.createMany({ data: base, skipDuplicates: true });

  const primaryNames = books.flatMap(b =>
    (b.primaryNameTranslations ?? []).map((t: any) => ({
      bookId: b.id,
      locale: t.locale,
      text: t.text,
    })),
  );
  if (primaryNames.length)
    await db.bookPrimaryName.createMany({ data: primaryNames, skipDuplicates: true });

  const otherNames = books.flatMap(b =>
    (b.otherNameTranslations ?? []).map((t: any) => ({
      bookId: b.id,
      locale: t.locale,
      texts: t.texts ?? [],
    })),
  );
  if (otherNames.length)
    await db.bookOtherNames.createMany({ data: otherNames, skipDuplicates: true });

  // Connect books <-> genres many-to-many
  const booksWithGenres = books
    .map(b => ({ id: b.id, genreIds: (b.genres ?? []).map((g: any) => g.id) }))
    .filter(b => b.genreIds.length > 0);

  for (const group of chunk(booksWithGenres, 50)) {
    await Promise.all(
      group.map(b =>
        db.book.update({
          where: { id: b.id },
          data: { genres: { set: [], connect: b.genreIds.map(id => ({ id })) } },
        }),
      ),
    );
  }

  console.log(
    `Seeded books: ${base.length} (with ${booksWithGenres.length} genre relations)`,
  );
}

async function seedAlternateSlugs() {
  const file = resolveCacheFile('alternate-slugs.json');
  const data = readJson<[UnknownRecord[], UnknownRecord[]]>(file);
  const [bookSlugs, authorSlugs] = data ?? [[], []];

  if (bookSlugs.length) {
    await db.bookAlternateSlug.createMany({
      data: bookSlugs.map(s => ({ slug: s.slug, bookId: s.bookId })),
      skipDuplicates: true,
    });
  }
  if (authorSlugs.length) {
    await db.authorAlternateSlug.createMany({
      data: authorSlugs.map(s => ({ slug: s.slug, authorId: s.authorId })),
      skipDuplicates: true,
    });
  }

  console.log(
    `Seeded alternate slugs: books=${bookSlugs.length}, authors=${authorSlugs.length}`,
  );
}

async function main() {
  console.log('Seeding from ./cache (fallback to ./.cache) ...');
  // Order matters due to FKs and relations
  await seedRegions();
  await seedLocations();
  await seedAuthors();
  await seedGenres();
  await seedBooks();
  // Optional file; seed if present
  try {
    await seedAlternateSlugs();
  } catch (_) {
    // ignore if file missing
  }
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
