// One-off: copy the full CVR registry from the handed-off SQLite db into
// Postgres. Read-only against the source SQLite file.
import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const SQLITE_PATH = process.argv[2] || "/Users/davaidavai/Downloads/Claude/cvr-tool/cvr.db";
const BATCH_SIZE = 5000;

const sqlite = new DatabaseSync(SQLITE_PATH, { readOnly: true });
const prisma = new PrismaClient();

function toCompanyRow(row) {
  return {
    cvrNummer: row.cvr_nummer,
    cvrEnhedsId: row.cvr_enheds_id,
    status: row.status,
    startdato: row.startdato,
    ophoersdato: row.ophoersdato,
    virksomhedsformKode: row.virksomhedsform_kode,
    virksomhedsformTekst: row.virksomhedsform_tekst,
    navn: row.navn,
    brancheKode: row.branche_kode,
    brancheTekst: row.branche_tekst,
    email: row.email,
    telefon: row.telefon,
    vejnavn: row.vejnavn,
    husnummer: row.husnummer,
    etage: row.etage,
    doer: row.doer,
    postnummer: row.postnummer,
    postdistrikt: row.postdistrikt,
    kommunekode: row.kommunekode,
    kommunenavn: row.kommunenavn,
    supplerendeBynavn: row.supplerende_bynavn,
    adresseFritekst: row.adresse_fritekst,
    landekode: row.landekode,
    produktionsenhederAntal: row.produktionsenheder_antal ?? 0,
    employees: row.employees,
    sizeBucket: row.size_bucket,
    likvideBeholdninger: row.likvide_beholdninger,
    egenkapital: row.egenkapital,
    driftsresultat: row.driftsresultat,
    nettoresultat: row.nettoresultat,
    udbetaltUdbytte: row.udbetalt_udbytte,
    kapitalforoegelse: row.kapitalforoegelse,
    regnskabAar: row.regnskab_aar,
    koebekraftScore: row.koebekraft_score,
  };
}

function toLeadRow(row) {
  return {
    cvrNummer: row.cvr_nummer,
    stage: row.stage,
    notes: row.notes,
    lastContacted: row.last_contacted,
    starred: !!row.starred,
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
  };
}

async function migrateCompanies() {
  const total = sqlite.prepare("SELECT COUNT(*) AS n FROM companies").get().n;
  console.log(`Migrating ${total} companies...`);
  let offset = 0;
  const stmt = sqlite.prepare("SELECT * FROM companies ORDER BY cvr_nummer LIMIT ? OFFSET ?");
  while (offset < total) {
    const rows = stmt.all(BATCH_SIZE, offset);
    if (rows.length === 0) break;
    await prisma.cvrCompany.createMany({ data: rows.map(toCompanyRow), skipDuplicates: true });
    offset += rows.length;
    console.log(`  ${offset}/${total}`);
  }
}

async function migrateLeads() {
  const rows = sqlite.prepare("SELECT * FROM leads").all();
  console.log(`Migrating ${rows.length} leads...`);
  for (const row of rows) {
    try {
      await prisma.cvrLead.upsert({
        where: { cvrNummer: row.cvr_nummer },
        create: toLeadRow(row),
        update: toLeadRow(row),
      });
    } catch (err) {
      // A lead can reference a cvr_nummer no longer present in the
      // companies snapshot (stale data) — skip it rather than aborting
      // the other 12.
      console.warn(`  skipped lead for ${row.cvr_nummer}: ${err.message.split("\n")[0]}`);
    }
  }
}

async function main() {
  await migrateCompanies();
  await migrateLeads();
  const companyCount = await prisma.cvrCompany.count();
  const leadCount = await prisma.cvrLead.count();
  console.log(`Done. cvrCompany=${companyCount} cvrLead=${leadCount}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    sqlite.close();
    await prisma.$disconnect();
  });
