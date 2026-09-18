// One-off: copy all existing data from the current Neon database to the new
// Railway Postgres database, in FK-safe order. Read-only against the source
// (Neon) — never deletes or modifies anything there.
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const SOURCE_URL = process.env.DATABASE_URL;
const TARGET_URL = process.env.RAILWAY_DATABASE_URL;

if (!SOURCE_URL || !TARGET_URL) {
  console.error("Need both DATABASE_URL (source, from .env) and RAILWAY_DATABASE_URL (target) set.");
  process.exit(1);
}

const src = new PrismaClient({ datasources: { db: { url: SOURCE_URL } } });
const dst = new PrismaClient({ datasources: { db: { url: TARGET_URL } } });

async function copy(model, label) {
  const rows = await src[model].findMany();
  if (rows.length === 0) {
    console.log(`${label}: 0 rows, skipped`);
    return;
  }
  await dst[model].createMany({ data: rows, skipDuplicates: true });
  console.log(`${label}: copied ${rows.length} rows`);
}

async function main() {
  await copy("user", "User");
  await copy("account", "Account");
  await copy("session", "Session");
  await copy("verificationToken", "VerificationToken");
  await copy("team", "Team");
  await copy("teamMember", "TeamMember");
  await copy("company", "Company");
  await copy("lead", "Lead");
  await copy("star", "Star");
  await copy("activityLog", "ActivityLog");
  await copy("companyList", "CompanyList");
  await copy("companyListItem", "CompanyListItem");
  await copy("passwordResetToken", "PasswordResetToken");

  // Realign the Company autoincrement sequence — createMany with explicit
  // ids doesn't advance Postgres's own sequence counter, so the next
  // cron-inserted company would collide with an existing id otherwise.
  const maxId = await dst.company.aggregate({ _max: { id: true } });
  if (maxId._max.id) {
    await dst.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Company"', 'id'), ${maxId._max.id}, true);`);
    console.log(`Company id sequence realigned to ${maxId._max.id}`);
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await src.$disconnect();
    await dst.$disconnect();
  });
