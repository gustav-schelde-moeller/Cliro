// One-off: backfill CvrCompany.region (from the same kommunekode->region
// mapping used at query time in src/lib/cvr/filters.ts) and lat/lng (from
// Danish postnummer centroids, via the free public DAWA API). Grouped by
// distinct value (~1090 postnumre, 5 regions) rather than per-row, so this
// runs in a couple of minutes instead of hours against 420k rows.
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();

// Verbatim copy of src/lib/cvr/filters.ts's REGIONS map — duplicated here
// rather than imported since this script runs outside the Next.js/ts-node
// build (matches the existing scripts/*.mjs convention of plain JS, no
// src/*.ts imports).
const REGIONS = {
  Hovedstaden: ["101", "147", "151", "153", "155", "157", "159", "161", "163", "165", "167", "169", "173", "175", "183", "185", "187", "190", "201", "210", "217", "219", "223", "230", "240", "250", "260", "270", "400", "411"],
  Sjælland: ["253", "259", "265", "269", "306", "316", "320", "326", "329", "330", "336", "340", "350", "360", "370", "376", "390"],
  Syddanmark: ["410", "420", "430", "440", "450", "461", "479", "480", "482", "492", "510", "530", "540", "550", "561", "563", "573", "575", "580", "607", "621", "630"],
  Midtjylland: ["615", "657", "661", "665", "671", "706", "707", "710", "727", "730", "740", "741", "746", "751", "756", "760", "766", "779", "791"],
  Nordjylland: ["773", "787", "810", "813", "820", "825", "840", "846", "849", "851", "860"],
};

async function backfillRegions() {
  console.log("Backfilling region from kommunekode...");
  let total = 0;
  for (const [region, kommuner] of Object.entries(REGIONS)) {
    const res = await prisma.cvrCompany.updateMany({
      where: { kommunekode: { in: kommuner } },
      data: { region },
    });
    console.log(`  ${region}: ${res.count} rows`);
    total += res.count;
  }
  console.log(`Region backfill done: ${total} rows total.\n`);
}

async function backfillLatLng() {
  console.log("Fetching Danish postnummer centroids from DAWA...");
  const res = await fetch("https://api.dataforsyningen.dk/postnumre?format=json");
  if (!res.ok) throw new Error(`DAWA fetch failed: ${res.status}`);
  const postnumre = await res.json();
  console.log(`  Got ${postnumre.length} postnumre.`);

  let total = 0;
  for (const p of postnumre) {
    const [lng, lat] = p.visueltcenter ?? [];
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    const result = await prisma.cvrCompany.updateMany({
      where: { postnummer: p.nr },
      data: { lat, lng },
    });
    total += result.count;
  }
  console.log(`Lat/lng backfill done: ${total} rows total.\n`);
}

await backfillRegions();
await backfillLatLng();

const [withRegion, withLatLng, totalCompanies] = await Promise.all([
  prisma.cvrCompany.count({ where: { region: { not: null } } }),
  prisma.cvrCompany.count({ where: { lat: { not: null } } }),
  prisma.cvrCompany.count(),
]);
console.log(`Summary: ${totalCompanies} companies total, ${withRegion} with region, ${withLatLng} with lat/lng.`);

await prisma.$disconnect();
