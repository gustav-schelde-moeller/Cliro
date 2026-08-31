import { prisma } from "./prisma";

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
    avatarDataUrl: m.user.avatarDataUrl,
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

export async function getUserTeams(userId: string) {
  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    include: { team: true },
    orderBy: { joinedAt: "desc" },
  });
  return memberships.map((m) => ({ id: m.team.id, name: m.team.name }));
}
