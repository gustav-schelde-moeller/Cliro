import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveTeamId } from "@/lib/session-team";
import { buildWhere, SORT_WHITELIST, STATUS_SORT_KEY, statusRank } from "@/lib/cvr/filters";
import { brancheDisplayGroup } from "@/lib/cvr/branche";
import { haversineKm } from "@/lib/companies";
import { mapCvrAnalysis } from "@/lib/queries";
import { toFollowUpIso } from "@/lib/followup";
import type { Prisma } from "@prisma/client";

const INCLUDE = (teamId: string, userId: string) =>
  ({
    teamLeads: { where: { teamId }, include: { assignee: { select: { name: true } } } },
    stars: { where: { userId } },
    listItems: {
      where: { list: { teamId, OR: [{ isPrivate: false }, { createdBy: userId }] } },
      select: { listId: true },
    },
    analysis: true,
  }) satisfies Prisma.CvrCompanyInclude;

type Row = Prisma.CvrCompanyGetPayload<{ include: ReturnType<typeof INCLUDE> }>;

function enrich(row: Row, lat: number | null, lng: number | null) {
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
      ? {
          status: teamLead.status,
          assigneeId: teamLead.assigneeId,
          assigneeName: teamLead.assignee?.name ?? null,
          followUpAt: toFollowUpIso(teamLead.followUpAt),
        }
      : null,
    starred: row.stars.length > 0,
    listIds: row.listItems.map((i) => i.listId),
    distanceKm: lat != null && lng != null && row.lat != null && row.lng != null ? haversineKm(lat, lng, row.lat, row.lng) : null,
    analysis: row.analysis ? mapCvrAnalysis(row.analysis) : null,
  };
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const teamId = await getActiveTeamId(session.user.id);
  if (!teamId) {
    return Response.json({ error: "No active team" }, { status: 400 });
  }
  const userId = session.user.id;

  const params = new URL(request.url).searchParams;
  const where = buildWhere({ ...Object.fromEntries(params), userId });

  const rawSort = params.get("sort") || "navn";
  const sort = rawSort === STATUS_SORT_KEY || SORT_WHITELIST.has(rawSort) ? rawSort : "navn";
  const dir = params.get("dir") === "desc" ? "desc" : "asc";

  const page = Math.max(1, parseInt(params.get("page") || "1", 10));
  const pageSize = Math.min(200, Math.max(1, parseInt(params.get("pageSize") || "50", 10)));

  const lat = params.get("lat") ? Number(params.get("lat")) : null;
  const lng = params.get("lng") ? Number(params.get("lng")) : null;

  const include = INCLUDE(teamId, userId);

  if (sort === STATUS_SORT_KEY) {
    // Status isn't a CvrCompany column — it's this team's CvrTeamLead.status
    // (absent = "new"), and Prisma's typed orderBy can't reach into a
    // filtered to-many relation like that. Sorted instead in two cheap,
    // fully-typed passes: pull just the matching cvrNummers (an indexed PK
    // scan) and separately this team's own leads — bounded by teamId alone,
    // never by an `IN (...cvrNummers)` filter, since with no other filters
    // active that list can run into the tens of thousands of CvrCompany
    // rows and blow past Postgres's ~32k bind-variable limit on a prepared
    // statement — then rank them against those leads and fetch the one page
    // of full rows, restoring that order (Prisma's `in` doesn't preserve it).
    const [matching, leads] = await Promise.all([
      prisma.cvrCompany.findMany({ where, select: { cvrNummer: true }, orderBy: { cvrNummer: "asc" } }),
      prisma.cvrTeamLead.findMany({ where: { teamId }, select: { cvrNummer: true, status: true } }),
    ]);
    const cvrNummers = matching.map((r) => r.cvrNummer);
    const statusByNummer = new Map(leads.map((l) => [l.cvrNummer, l.status]));
    const sorted = cvrNummers.slice().sort((a, b) => {
      const ra = statusRank(statusByNummer.get(a));
      const rb = statusRank(statusByNummer.get(b));
      if (ra !== rb) return dir === "asc" ? ra - rb : rb - ra;
      return a.localeCompare(b);
    });

    const total = sorted.length;
    const pageIds = sorted.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
    const rows = await prisma.cvrCompany.findMany({ where: { cvrNummer: { in: pageIds } }, include });
    const rowById = new Map(rows.map((r) => [r.cvrNummer, r]));
    const ordered = pageIds.map((id) => rowById.get(id)).filter((r): r is Row => Boolean(r));

    return Response.json({ rows: ordered.map((r) => enrich(r, lat, lng)), total, page, pageSize });
  }

  const [total, rows] = await Promise.all([
    prisma.cvrCompany.count({ where }),
    prisma.cvrCompany.findMany({
      where,
      include,
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

  return Response.json({ rows: rows.map((r) => enrich(r, lat, lng)), total, page, pageSize });
}
