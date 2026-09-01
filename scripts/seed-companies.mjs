// One-time migration: copies the 47 hand-researched companies from
// src/lib/companies-data.json into the new Company table, preserving their
// exact ids (existing Lead/Star rows in production reference these ids).
// Safe to re-run — skips any id that already exists.
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

async function main() {
  const raw = readFileSync(join(__dirname, "../src/lib/companies-data.json"), "utf-8");
  const companies = JSON.parse(raw);

  let inserted = 0;
  let skipped = 0;
  for (const c of companies) {
    const existing = await prisma.company.findUnique({ where: { id: c.id } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.company.create({
      data: {
        id: c.id,
        name: c.name,
        website: c.website,
        industry: c.industry,
        city: c.city,
        lat: c.lat,
        lng: c.lng,
        score: c.score,
        breakdown: c.breakdown,
        dateRank: c.dateRank,
        tier: c.tier,
        hook: c.hook,
        existing: c.existing,
        social: c.social,
        idea: c.idea,
        contact: c.contact,
        mail: c.mail,
      },
    });
    inserted++;
  }

  // Explicit ids were inserted above, which doesn't advance Postgres's
  // autoincrement sequence — reset it so the next INSERT (id omitted) picks
  // up at max(id)+1 instead of colliding with an existing row.
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"Company"', 'id'), COALESCE((SELECT MAX(id) FROM "Company"), 1))`
  );

  console.log(`Seeded ${inserted} companies (${skipped} already present).`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
