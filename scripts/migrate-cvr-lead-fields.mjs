// One-off: migrate the old CvrLead.stage/starred data (dropped along with
// the cvr_leads table when the new team-scoped CvrTeamLead/CvrStar models
// were pushed) into the new tables, from a pre-drop JSON snapshot.
//
// stage -> CvrTeamLead.status mapping is a deliberately conservative,
// documented one-off choice (no clean 1:1 mapping exists between the old
// ad-hoc 4-stage vocabulary and STATUS_DEFS):
//   kontaktet -> contacted, svar -> contacted, mode -> meeting, pipeline -> meeting
// Never auto-promoted to "won" — that requires a human decision.
//
// Neither stage nor starred were ever team- or user-scoped in the old data,
// so there's no historical attribution to recover. All rows are attributed
// to the oldest team and its owner.
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import "dotenv/config";

const SNAPSHOT_PATH = process.argv[2];
if (!SNAPSHOT_PATH) {
  console.error("Usage: node scripts/migrate-cvr-lead-fields.mjs <path-to-snapshot.json>");
  process.exit(1);
}

const STAGE_TO_STATUS = {
  kontaktet: "contacted",
  svar: "contacted",
  mode: "meeting",
  pipeline: "meeting",
};

const prisma = new PrismaClient();
const rows = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));

const team = await prisma.team.findFirst({ orderBy: { createdAt: "asc" } });
if (!team) throw new Error("No team found — nothing to attribute this data to.");
console.log(`Attributing to team "${team.name}" (${team.id}), owner ${team.ownerId}.\n`);

const report = [];

for (const row of rows) {
  const cvrNummer = row.cvrNummer;

  if (row.stage) {
    const status = STAGE_TO_STATUS[row.stage] ?? "new";
    await prisma.cvrTeamLead.upsert({
      where: { teamId_cvrNummer: { teamId: team.id, cvrNummer } },
      create: { teamId: team.id, cvrNummer, status },
      update: { status },
    });
    report.push({ cvrNummer, field: "stage", old: row.stage, new: status });
  }

  if (row.starred) {
    await prisma.cvrStar.upsert({
      where: { userId_cvrNummer: { userId: team.ownerId, cvrNummer } },
      create: { userId: team.ownerId, cvrNummer },
      update: {},
    });
    report.push({ cvrNummer, field: "starred", old: true, new: `star for ${team.ownerId}` });
  }
}

console.table(report);
console.log(`\nMigrated ${rows.length} rows.`);

await prisma.$disconnect();
