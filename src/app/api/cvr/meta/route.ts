import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildWhere, REGION_BY_KOMMUNEKODE } from "@/lib/cvr/filters";
import { brancheDisplayGroup } from "@/lib/cvr/branche";

const REGION_ORDER = ["Hovedstaden", "Sjælland", "Syddanmark", "Midtjylland", "Nordjylland"];

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = { ...Object.fromEntries(new URL(request.url).searchParams), userId: session.user.id };

  // Each facet's own filter is excluded from its own count query (standard
  // faceted-search behaviour), but every other active filter still applies —
  // so typing a postnummer or picking a kommune updates the branche counts.
  const brancheWhere = buildWhere(params, new Set(["branche"]));
  const regionWhere = buildWhere(params, new Set(["region"]));
  const totalWhere = buildWhere(params);

  const [rawBrancher, rawKommuner, total, withEmployees] = await Promise.all([
    prisma.cvrCompany.groupBy({
      by: ["brancheKode", "brancheTekst"],
      where: { AND: [brancheWhere, { brancheKode: { not: null } }] },
      _count: { _all: true },
    }),
    prisma.cvrCompany.groupBy({
      by: ["kommunekode"],
      where: { AND: [regionWhere, { kommunekode: { not: null } }] },
      _count: { _all: true },
    }),
    prisma.cvrCompany.count({ where: totalWhere }),
    prisma.cvrCompany.count({ where: { AND: [totalWhere, { employees: { not: null } }] } }),
  ]);

  // Collapse raw industry codes into plain-language groups and sum their
  // counts, so e.g. all housing/property codes become one "Ejendomme"
  // option instead of eight near-duplicate entries.
  const brancheByLabel = new Map<string, { label: string; kodes: string[]; n: number }>();
  for (const row of rawBrancher) {
    const group = brancheDisplayGroup(row.brancheKode, row.brancheTekst);
    const existing = brancheByLabel.get(group.label);
    const n = row._count._all;
    if (existing) {
      existing.n += n;
      if (row.brancheKode && !existing.kodes.includes(row.brancheKode)) existing.kodes.push(row.brancheKode);
    } else {
      brancheByLabel.set(group.label, { label: group.label, kodes: [...group.kodes], n });
    }
  }
  const brancher = [...brancheByLabel.values()].sort((a, b) => b.n - a.n).slice(0, 300);

  const regionCounts = new Map<string, number>();
  for (const row of rawKommuner) {
    const region = row.kommunekode ? REGION_BY_KOMMUNEKODE.get(row.kommunekode) : undefined;
    if (!region) continue;
    regionCounts.set(region, (regionCounts.get(region) || 0) + row._count._all);
  }
  const regioner = REGION_ORDER.filter((r) => regionCounts.has(r)).map((r) => ({ region: r, n: regionCounts.get(r)! }));

  return Response.json({ brancher, regioner, total, withEmployees });
}
