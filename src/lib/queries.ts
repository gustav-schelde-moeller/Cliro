import type { CvrAnalysis } from "@prisma/client";
import { prisma } from "./prisma";
import { getCompanies, type Company } from "./companies";
import { brancheDisplayGroup } from "./cvr/branche";
import type { CvrCompanyRow, CvrAnalysisData } from "@/components/leads/CvrBrowser";

// Prisma's Json columns type as the broad `JsonValue` union — cast to the
// specific shape the AI's structured-output tool guarantees (see
// src/app/api/cvr/analyze/[cvr]/route.ts's ANALYZE_TOOL), same convention
// src/lib/companies.ts's rowToCompany already uses for Company's Json
// fields.
export function mapCvrAnalysis(row: CvrAnalysis): CvrAnalysisData {
  return {
    score: row.score,
    breakdown: row.breakdown as CvrAnalysisData["breakdown"],
    tier: row.tier as CvrAnalysisData["tier"],
    hook: row.hook as CvrAnalysisData["hook"],
    existing: row.existing,
    social: row.social,
    idea: row.idea,
    contact: row.contact as CvrAnalysisData["contact"],
    mail: row.mail as CvrAnalysisData["mail"],
    analyzedAt: row.analyzedAt.toISOString(),
  };
}

export type TeamMemberInfo = {
  userId: string;
  name: string;
  email: string;
  avatarDataUrl: string | null;
  role: "admin" | "member";
  isOwner: boolean;
  joinedAt: Date;
};

export async function getTeamWithRole(teamId: string, userId: string) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return null;
  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
  if (!membership) return null;
  return {
    team,
    role: membership.role as "admin" | "member",
    isOwner: team.ownerId === userId,
    isAdmin: membership.role === "admin",
  };
}

export async function getTeamMembers(teamId: string, ownerId: string): Promise<TeamMemberInfo[]> {
  const members = await prisma.teamMember.findMany({
    where: { teamId },
    include: { user: true },
    orderBy: { user: { name: "asc" } },
  });
  return members.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    avatarDataUrl: m.user.avatarDataUrl ?? m.user.image,
    role: m.role as "admin" | "member",
    isOwner: m.userId === ownerId,
    joinedAt: m.joinedAt,
  }));
}

export type LeadState = { status: string; assigneeId: string | null; assigneeName: string | null };

export async function getTeamLeadsMap(teamId: string): Promise<Map<number, LeadState>> {
  const leads = await prisma.lead.findMany({
    where: { teamId },
    include: { assignee: { select: { name: true } } },
  });
  const map = new Map<number, LeadState>();
  for (const lead of leads) {
    map.set(lead.companyId, {
      status: lead.status,
      assigneeId: lead.assigneeId,
      assigneeName: lead.assignee?.name ?? null,
    });
  }
  return map;
}

export async function getUserStars(userId: string): Promise<Set<number>> {
  const stars = await prisma.star.findMany({ where: { userId }, select: { companyId: true } });
  return new Set(stars.map((s) => s.companyId));
}

// CVR equivalent of getTeamLeadsMap — only companies someone has actually
// touched (set a status or assigned themselves) show up here, never all
// 420k CVR rows.
export async function getTeamCvrLeadsMap(teamId: string): Promise<Map<string, LeadState>> {
  const leads = await prisma.cvrTeamLead.findMany({
    where: { teamId },
    include: { assignee: { select: { name: true } } },
  });
  const map = new Map<string, LeadState>();
  for (const lead of leads) {
    map.set(lead.cvrNummer, {
      status: lead.status,
      assigneeId: lead.assigneeId,
      assigneeName: lead.assignee?.name ?? null,
    });
  }
  return map;
}

export async function getUserCvrStars(userId: string): Promise<Set<string>> {
  const stars = await prisma.cvrStar.findMany({ where: { userId }, select: { cvrNummer: true } });
  return new Set(stars.map((s) => s.cvrNummer));
}

// Full CvrCompanyRow shape (same enrichment as /api/cvr/companies) for a
// specific set of companies — used by Dashboard/Team to render touched CVR
// companies without going through the paginated search endpoint.
export async function getCvrCompanyRows(teamId: string, userId: string, cvrNummers: string[]): Promise<CvrCompanyRow[]> {
  if (cvrNummers.length === 0) return [];
  const rows = await prisma.cvrCompany.findMany({
    where: { cvrNummer: { in: cvrNummers } },
    include: {
      teamLeads: { where: { teamId }, include: { assignee: { select: { name: true } } } },
      stars: { where: { userId } },
      listItems: {
        where: { list: { teamId, OR: [{ isPrivate: false }, { createdBy: userId }] } },
        select: { listId: true },
      },
      analysis: true,
    },
  });
  return rows.map((row) => {
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
      distanceKm: null,
      analysis: row.analysis ? mapCvrAnalysis(row.analysis) : null,
    };
  });
}

export async function getActivityLog(teamId: string, limit: number) {
  return prisma.activityLog.findMany({
    where: { teamId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export type CompanyListInfo = {
  id: string;
  name: string;
  createdAt: Date;
  createdByName: string | null;
  isPrivate: boolean;
  isMine: boolean;
  itemCount: number;
};

// Visible lists for a given user: every public team list, plus that user's
// own private lists. Private lists never leak to anyone but their creator.
function visibilityWhere(teamId: string, userId: string) {
  return { teamId, OR: [{ isPrivate: false }, { createdBy: userId }] };
}

export async function getTeamLists(teamId: string, userId: string): Promise<CompanyListInfo[]> {
  const lists = await prisma.companyList.findMany({
    where: visibilityWhere(teamId, userId),
    include: { items: true, cvrItems: true },
    orderBy: { createdAt: "desc" },
  });
  const creatorIds = Array.from(new Set(lists.map((l) => l.createdBy)));
  const creators = await prisma.user.findMany({ where: { id: { in: creatorIds } }, select: { id: true, name: true } });
  const creatorNames = new Map(creators.map((c) => [c.id, c.name]));
  return lists.map((l) => ({
    id: l.id,
    name: l.name,
    createdAt: l.createdAt,
    createdByName: creatorNames.get(l.createdBy) ?? null,
    isPrivate: l.isPrivate,
    isMine: l.createdBy === userId,
    itemCount: l.items.length + l.cvrItems.length,
  }));
}

// Team page's "all team lists" section — public lists only, regardless of
// who's asking, since a private list must never show up here.
export async function getPublicTeamLists(teamId: string): Promise<CompanyListInfo[]> {
  const lists = await prisma.companyList.findMany({
    where: { teamId, isPrivate: false },
    include: { items: true, cvrItems: true },
    orderBy: { createdAt: "desc" },
  });
  const creatorIds = Array.from(new Set(lists.map((l) => l.createdBy)));
  const creators = await prisma.user.findMany({ where: { id: { in: creatorIds } }, select: { id: true, name: true } });
  const creatorNames = new Map(creators.map((c) => [c.id, c.name]));
  return lists.map((l) => ({
    id: l.id,
    name: l.name,
    createdAt: l.createdAt,
    createdByName: creatorNames.get(l.createdBy) ?? null,
    isPrivate: l.isPrivate,
    isMine: false,
    itemCount: l.items.length + l.cvrItems.length,
  }));
}

// Map of companyId -> set of list IDs that company currently belongs to,
// for rendering per-card "which lists is this in" checkboxes. Scoped to
// lists the user can see (visibilityWhere), so a private list's membership
// never surfaces to anyone but its creator.
export async function getCompanyListMemberships(teamId: string, userId: string): Promise<Map<number, Set<string>>> {
  const items = await prisma.companyListItem.findMany({
    where: { list: visibilityWhere(teamId, userId) },
    select: { companyId: true, listId: true },
  });
  const map = new Map<number, Set<string>>();
  for (const item of items) {
    const set = map.get(item.companyId) ?? new Set<string>();
    set.add(item.listId);
    map.set(item.companyId, set);
  }
  return map;
}

// CVR equivalent of getCompanyListMemberships.
export async function getCvrListMemberships(teamId: string, userId: string): Promise<Map<string, Set<string>>> {
  const items = await prisma.cvrListItem.findMany({
    where: { list: visibilityWhere(teamId, userId) },
    select: { cvrNummer: true, listId: true },
  });
  const map = new Map<string, Set<string>>();
  for (const item of items) {
    const set = map.get(item.cvrNummer) ?? new Set<string>();
    set.add(item.listId);
    map.set(item.cvrNummer, set);
  }
  return map;
}

export type CompanyListWithCompanies = {
  id: string;
  name: string;
  createdAt: Date;
  createdByName: string | null;
  isPrivate: boolean;
  isMine: boolean;
  companies: Company[];
  cvrCompanies: {
    cvrNummer: string;
    navn: string | null;
    brancheTekst: string | null;
    kommunenavn: string | null;
    email: string | null;
    telefon: string | null;
    koebekraftScore: number | null;
  }[];
};

export async function getListsWithCompanies(teamId: string, userId: string): Promise<CompanyListWithCompanies[]> {
  const [lists, allCompanies] = await Promise.all([
    prisma.companyList.findMany({
      where: visibilityWhere(teamId, userId),
      include: { items: true, cvrItems: { include: { company: true } } },
      orderBy: { createdAt: "desc" },
    }),
    getCompanies(),
  ]);
  const companyById = new Map(allCompanies.map((c) => [c.id, c]));
  const creatorIds = Array.from(new Set(lists.map((l) => l.createdBy)));
  const creators = await prisma.user.findMany({ where: { id: { in: creatorIds } }, select: { id: true, name: true } });
  const creatorNames = new Map(creators.map((c) => [c.id, c.name]));

  return lists.map((l) => ({
    id: l.id,
    name: l.name,
    createdAt: l.createdAt,
    createdByName: creatorNames.get(l.createdBy) ?? null,
    isPrivate: l.isPrivate,
    isMine: l.createdBy === userId,
    companies: l.items.map((i) => companyById.get(i.companyId)).filter((c): c is Company => Boolean(c)),
    cvrCompanies: l.cvrItems.map((i) => ({
      cvrNummer: i.company.cvrNummer,
      navn: i.company.navn,
      brancheTekst: i.company.brancheTekst,
      kommunenavn: i.company.kommunenavn,
      email: i.company.email,
      telefon: i.company.telefon,
      koebekraftScore: i.company.koebekraftScore,
    })),
  }));
}

export async function getUserTeams(userId: string) {
  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    include: { team: true },
    orderBy: { joinedAt: "desc" },
  });
  return memberships.map((m) => ({ id: m.team.id, name: m.team.name }));
}
