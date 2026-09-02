import { prisma } from "./prisma";
import { getCompanies, type Company } from "./companies";

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
  itemCount: number;
};

export async function getTeamLists(teamId: string): Promise<CompanyListInfo[]> {
  const lists = await prisma.companyList.findMany({
    where: { teamId },
    include: { items: true },
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
    itemCount: l.items.length,
  }));
}

// Map of companyId -> set of list IDs that company currently belongs to,
// for rendering per-card "which lists is this in" checkboxes.
export async function getCompanyListMemberships(teamId: string): Promise<Map<number, Set<string>>> {
  const items = await prisma.companyListItem.findMany({
    where: { list: { teamId } },
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

export type CompanyListWithCompanies = {
  id: string;
  name: string;
  createdAt: Date;
  createdByName: string | null;
  companies: Company[];
};

export async function getListsWithCompanies(teamId: string): Promise<CompanyListWithCompanies[]> {
  const [lists, allCompanies] = await Promise.all([
    prisma.companyList.findMany({
      where: { teamId },
      include: { items: true },
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
    companies: l.items.map((i) => companyById.get(i.companyId)).filter((c): c is Company => Boolean(c)),
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
