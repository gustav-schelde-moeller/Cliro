import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { REGION_BY_KOMMUNEKODE } from "@/lib/cvr/filters";
import { brancheDisplayGroup } from "@/lib/cvr/branche";

type FunnelCounts = { kontaktet: number; svar: number; mode: number; pipeline: number };
type GroupRow = FunnelCounts & { key: string; total: number };

function emptyFunnel(): FunnelCounts {
  return { kontaktet: 0, svar: 0, mode: 0, pipeline: 0 };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Every worked (non-null-stage) lead, joined with its company for
  // branche/region/postnummer/size breakdowns. 420k companies but only a
  // handful of leads ever get a stage, so this result set stays small.
  const workedLeads = await prisma.cvrLead.findMany({
    where: { stage: { not: null }, company: { status: "aktiv" } },
    select: {
      stage: true,
      company: { select: { brancheKode: true, brancheTekst: true, kommunekode: true, postnummer: true, employees: true } },
    },
  });

  const funnel = emptyFunnel();
  let totalWorked = 0;
  const byBrancheMap = new Map<string, GroupRow>();
  const byRegionMap = new Map<string, GroupRow>();
  const byPostnummerMap = new Map<string, GroupRow>();
  const bySizeMap = new Map<string, GroupRow>();

  function bump(map: Map<string, GroupRow>, key: string, stage: string) {
    if (!map.has(key)) map.set(key, { key, ...emptyFunnel(), total: 0 });
    const g = map.get(key)!;
    if (stage in g) (g as unknown as Record<string, number>)[stage] += 1;
    g.total += 1;
  }

  for (const lead of workedLeads) {
    const stage = lead.stage as keyof FunnelCounts;
    if (stage in funnel) {
      funnel[stage] += 1;
      totalWorked += 1;
    }

    const brancheLabel = lead.company.brancheKode ? brancheDisplayGroup(lead.company.brancheKode, lead.company.brancheTekst).label : "Ukendt";
    bump(byBrancheMap, brancheLabel, stage);

    const regionLabel = (lead.company.kommunekode && REGION_BY_KOMMUNEKODE.get(lead.company.kommunekode)) || "Ukendt";
    bump(byRegionMap, regionLabel, stage);

    bump(byPostnummerMap, lead.company.postnummer || "Ukendt", stage);

    const employees = lead.company.employees;
    const sizeLabel = employees == null ? "Ukendt" : employees < 50 ? "Lille" : employees < 250 ? "Mellem" : "Stor";
    bump(bySizeMap, sizeLabel, stage);
  }

  const responded = funnel.svar + funnel.mode + funnel.pipeline;
  const svarRate = totalWorked > 0 ? responded / totalWorked : null;
  const modeRate = totalWorked > 0 ? (funnel.mode + funnel.pipeline) / totalWorked : null;

  const sortByTotal = (a: GroupRow, b: GroupRow) => b.total - a.total;

  return Response.json({
    funnel,
    totalWorked,
    svarRate,
    modeRate,
    byBranche: [...byBrancheMap.values()].sort(sortByTotal),
    byRegion: [...byRegionMap.values()].sort(sortByTotal),
    byPostnummer: [...byPostnummerMap.values()].sort(sortByTotal).slice(0, 30),
    bySize: [...bySizeMap.values()].sort(sortByTotal),
  });
}
