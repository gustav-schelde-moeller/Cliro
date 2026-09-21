import type { Prisma } from "@prisma/client";

export const SORT_WHITELIST = new Set([
  "navn",
  "brancheTekst",
  "kommunenavn",
  "region",
  "postnummer",
  "produktionsenhederAntal",
  "employees",
  "koebekraftScore",
]);

// "status" is handled separately (see /api/cvr/companies) — it isn't a
// column on CvrCompany at all, it's this team's CvrTeamLead.status, so a
// plain Prisma orderBy can't reach it the way it reaches the columns above.
export const STATUS_SORT_KEY = "status";
export const STATUS_RANK: Record<string, number> = { new: 0, contacted: 1, meeting: 2, won: 3, lost: 4 };
export function statusRank(status: string | undefined): number {
  return status != null ? (STATUS_RANK[status] ?? 0) : 0;
}

// Denmark's 5 administrative regions, by kommunekode. Verbatim port of the
// handed-off cvr-tool's REGIONS table (verified against the actual
// kommunekode/kommunenavn pairs present in the data). CvrCompany.region is
// a persisted backfill of this same lookup (scripts/backfill-cvr-derived-fields.mjs)
// so it can be sorted/filtered as a real indexed column.
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

// Approximate radius filter via a lat/lng bounding box — the same tier of
// "approximate" the postnummer-centroid coordinates themselves already are,
// so exact-radius precision (PostGIS, a real geo index) would be spending
// effort on precision the data can't back up anyway.
function distanceBoundingBoxWhere(lat: number, lng: number, maxDistanceKm: number): Prisma.CvrCompanyWhereInput {
  const latDelta = maxDistanceKm / 111;
  const lngDelta = maxDistanceKm / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    lat: { gte: lat - latDelta, lte: lat + latDelta },
    lng: { gte: lng - lngDelta, lte: lng + lngDelta },
  };
}

export type CvrFilterParams = {
  q?: string | null;
  branche?: string | null;
  region?: string | null;
  size?: string | null;
  koebekraft?: string | null;
  starred?: string | null;
  lat?: string | null;
  lng?: string | null;
  maxDistanceKm?: string | null;
  // Set server-side from the session — never trust a query-string value for
  // this, since it scopes the private "my stars" filter.
  userId?: string;
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
    AND.push({ region });
  }

  const size = params.size;
  const sizeWhere = size && !exclude.has("size") ? sizeBucketWhere(size) : null;
  if (sizeWhere) AND.push(sizeWhere);

  const koebekraft = params.koebekraft;
  const koebekraftWhere = koebekraft && !exclude.has("koebekraft") ? koebekraftBucketWhere(koebekraft) : null;
  if (koebekraftWhere) AND.push(koebekraftWhere);

  const starred = params.starred;
  if (starred && !exclude.has("starred") && params.userId) {
    AND.push({ stars: { some: { userId: params.userId } } });
  }

  const lat = params.lat ? Number(params.lat) : null;
  const lng = params.lng ? Number(params.lng) : null;
  const maxDistanceKm = params.maxDistanceKm ? Number(params.maxDistanceKm) : null;
  if (lat != null && lng != null && maxDistanceKm != null && !exclude.has("distance")) {
    AND.push(distanceBoundingBoxWhere(lat, lng, maxDistanceKm));
  }

  return { AND };
}
