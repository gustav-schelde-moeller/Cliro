import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveTeamId } from "@/lib/session-team";
import { buildWhere, SORT_WHITELIST } from "@/lib/cvr/filters";
import { brancheDisplayGroup } from "@/lib/cvr/branche";
import { haversineKm } from "@/lib/companies";
import { mapCvrAnalysis } from "@/lib/queries";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const teamId = await getActiveTeamId(session.user.id);
  if (!teamId) {
    return Response.json({ error: "No active team" }, { status: 400 });
  }

  const params = new URL(request.url).searchParams;
  const where = buildWhere({ ...Object.fromEntries(params), userId: session.user.id });

  let sort = params.get("sort") || "navn";
  if (!SORT_WHITELIST.has(sort)) sort = "navn";
  const dir = params.get("dir") === "desc" ? "desc" : "asc";

  const page = Math.max(1, parseInt(params.get("page") || "1", 10));
  const pageSize = Math.min(200, Math.max(1, parseInt(params.get("pageSize") || "50", 10)));

  const lat = params.get("lat") ? Number(params.get("lat")) : null;
  const lng = params.get("lng") ? Number(params.get("lng")) : null;

  const [total, rows] = await Promise.all([
    prisma.cvrCompany.count({ where }),
    prisma.cvrCompany.findMany({
      where,
      include: {
        teamLeads: { where: { teamId }, include: { assignee: { select: { name: true } } } },
        stars: { where: { userId: session.user.id } },
        listItems: {
          where: { list: { teamId, OR: [{ isPrivate: false }, { createdBy: session.user.id }] } },
          select: { listId: true },
        },
        analysis: true,
      },
      // cvrNummer as a secondary sort key guarantees a stable, deterministic
      // order across paginated requests — without it, ties on the primary
      // sort field (very common for koebekraftScore, which is banded into a
      // small number of integer values) let Postgres return rows in a
      // different relative order per request, causing the same row to
      // appear on two pages while another is skipped entirely.
      orderBy: [{ [sort]: { sort: dir, nulls: "last" } }, { cvrNummer: "asc" }],
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
  ]);

  const enriched = rows.map((row) => {
    const teamLead = row.teamLeads[0] ?? null;
    return {
      cvrNummer: row.cvrNummer,
      navn: row.navn,
      virksomhedsformTekst: row.virksomhedsformTekst,
      brancheKode: row.brancheKode,
      brancheTekst: row.brancheTekst,
      brancheLabel: row.brancheKode ? brancheDisplayGroup(row.brancheKode, row.brancheTekst).label : null,
      email: row.email,
      telefon: row.telefon,
      vejnavn: row.vejnavn,
      husnummer: row.husnummer,
      postnummer: row.postnummer,
      postdistrikt: row.postdistrikt,
      kommunenavn: row.kommunenavn,
      region: row.region,
      employees: row.employees,
      produktionsenhederAntal: row.produktionsenhederAntal,
      egenkapital: row.egenkapital,
      driftsresultat: row.driftsresultat,
      nettoresultat: row.nettoresultat,
      likvideBeholdninger: row.likvideBeholdninger,
      regnskabAar: row.regnskabAar,
      koebekraftScore: row.koebekraftScore,
      pipeline: teamLead
        ? { status: teamLead.status, assigneeId: teamLead.assigneeId, assigneeName: teamLead.assignee?.name ?? null }
        : null,
      starred: row.stars.length > 0,
      listIds: row.listItems.map((i) => i.listId),
      distanceKm: lat != null && lng != null && row.lat != null && row.lng != null ? haversineKm(lat, lng, row.lat, row.lng) : null,
      analysis: row.analysis ? mapCvrAnalysis(row.analysis) : null,
    };
  });

  return Response.json({ rows: enriched, total, page, pageSize });
}
