import type { Prisma } from "@prisma/client";

export const SORT_WHITELIST = new Set([
  "navn",
  "brancheTekst",
  "kommunenavn",
  "postnummer",
  "produktionsenhederAntal",
  "employees",
  "koebekraftScore",
]);

// Denmark's 5 administrative regions, by kommunekode. Verbatim port of the
// handed-off cvr-tool's REGIONS table (verified against the actual
// kommunekode/kommunenavn pairs present in the data).
export const REGIONS: Record<string, string[]> = {
  Hovedstaden: ["101", "147", "151", "153", "155", "157", "159", "161", "163", "165", "167", "169", "173", "175", "183", "185", "187", "190", "201", "210", "217", "219", "223", "230", "240", "250", "260", "270", "400", "411"],
  Sjælland: ["253", "259", "265", "269", "306", "316", "320", "326", "329", "330", "336", "340", "350", "360", "370", "376", "390"],
  Syddanmark: ["410", "420", "430", "440", "450", "461", "479", "480", "482", "492", "510", "530", "540", "550", "561", "563", "573", "575", "580", "607", "621", "630"],
  Midtjylland: ["615", "657", "661", "665", "671", "706", "707", "710", "727", "730", "740", "741", "746", "751", "756", "760", "766", "779", "791"],
  Nordjylland: ["773", "787", "810", "813", "820", "825", "840", "846", "849", "851", "860"],
};

export const REGION_BY_KOMMUNEKODE = new Map<string, string>();
for (const [region, kommuner] of Object.entries(REGIONS)) {
  for (const k of kommuner) REGION_BY_KOMMUNEKODE.set(k, region);
}

export const STAGE_LABELS: Record<string, string> = {
  kontaktet: "Kontaktet",
  svar: "Svar",
  mode: "Møde",
  pipeline: "Pipeline",
};

function sizeBucketWhere(size: string): Prisma.CvrCompanyWhereInput | null {
  if (size === "small") return { employees: { gte: 10, lt: 50 } };
  if (size === "medium") return { employees: { gte: 50, lt: 250 } };
  if (size === "big") return { employees: { gte: 250 } };
  if (size === "unknown") return { employees: null };
  return null;
}

// Matches the 4 bands from the original købekraft scoring model.
function koebekraftBucketWhere(bucket: string): Prisma.CvrCompanyWhereInput | null {
  if (bucket === "high") return { koebekraftScore: { gte: 90 } };
  if (bucket === "solid") return { koebekraftScore: { gte: 60, lt: 90 } };
  if (bucket === "agil") return { koebekraftScore: { gte: 30, lt: 60 } };
  if (bucket === "nogo") return { koebekraftScore: { lt: 30 } };
  if (bucket === "unknown") return { koebekraftScore: null };
  return null;
}

export type CvrFilterParams = {
  q?: string | null;
  branche?: string | null;
  region?: string | null;
  size?: string | null;
  koebekraft?: string | null;
  stage?: string | null;
  starred?: string | null;
};

// Builds a Prisma where-clause from the current filter params. `exclude`
// skips a given filter dimension's own clause — used for faceted counts, so
// e.g. the branche dropdown's counts reflect every OTHER active filter but
// not the branche selection itself (otherwise every option but the selected
// one would show 0).
export function buildWhere(params: CvrFilterParams, exclude: Set<string> = new Set()): Prisma.CvrCompanyWhereInput {
  const AND: Prisma.CvrCompanyWhereInput[] = [{ status: "aktiv" }];

  const q = (params.q || "").trim();
  if (q && !exclude.has("q")) {
    if (/^\d{6,8}$/.test(q)) {
      AND.push({ cvrNummer: q });
    } else {
      AND.push({ navn: { contains: q, mode: "insensitive" } });
    }
  }

  const branche = params.branche;
  if (branche && !exclude.has("branche")) {
    AND.push({ brancheKode: { in: branche.split(",") } });
  }

  const region = params.region;
  if (region && !exclude.has("region")) {
    AND.push({ kommunekode: { in: REGIONS[region] || [] } });
  }

  const size = params.size;
  const sizeWhere = size && !exclude.has("size") ? sizeBucketWhere(size) : null;
  if (sizeWhere) AND.push(sizeWhere);

  const koebekraft = params.koebekraft;
  const koebekraftWhere = koebekraft && !exclude.has("koebekraft") ? koebekraftBucketWhere(koebekraft) : null;
  if (koebekraftWhere) AND.push(koebekraftWhere);

  const stage = params.stage;
  if (stage && !exclude.has("stage")) {
    AND.push(stage === "none" ? { lead: null } : { lead: { stage } });
  }

  const starred = params.starred;
  if (starred && !exclude.has("starred")) {
    AND.push({ lead: { starred: true } });
  }

  return { AND };
}
