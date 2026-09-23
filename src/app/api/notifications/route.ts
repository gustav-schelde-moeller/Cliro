import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveTeamId } from "@/lib/session-team";
import { addDaysIso, todayIso, toFollowUpIso } from "@/lib/followup";
import { pipelineHref } from "@/lib/notifications";
import type { FollowUpItem, NotificationsPayload } from "@/lib/notification-types";

const FOLLOW_UP_HORIZON_DAYS = 7;

async function currentContext() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const teamId = await getActiveTeamId(session.user.id);
  if (!teamId) return null;
  return { userId: session.user.id, teamId };
}

export async function GET() {
  const ctx = await currentContext();
  if (!ctx) return Response.json({ error: "Ikke logget ind." }, { status: 401 });
  const { userId, teamId } = ctx;

  // Your own follow-ups that are overdue, due today, or coming up this week.
  const horizon = new Date(`${addDaysIso(todayIso(), FOLLOW_UP_HORIZON_DAYS)}T00:00:00.000Z`);
  const [items, unread, leads, cvrLeads] = await Promise.all([
    prisma.notification.findMany({ where: { teamId, recipientId: userId }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.notification.count({ where: { teamId, recipientId: userId, readAt: null } }),
    prisma.lead.findMany({
      where: { teamId, assigneeId: userId, followUpAt: { lte: horizon } },
      select: { companyId: true, followUpAt: true },
    }),
    prisma.cvrTeamLead.findMany({
      where: { teamId, assigneeId: userId, followUpAt: { lte: horizon } },
      select: { cvrNummer: true, followUpAt: true, company: { select: { navn: true } } },
    }),
  ]);
  const companies = leads.length
    ? await prisma.company.findMany({ where: { id: { in: leads.map((l) => l.companyId) } }, select: { id: true, name: true } })
    : [];
  const companyName = new Map(companies.map((c) => [c.id, c.name]));

  const followUps: FollowUpItem[] = [
    ...leads.map((l) => ({
      key: `lead-${l.companyId}`,
      name: companyName.get(l.companyId) ?? "Ukendt virksomhed",
      date: toFollowUpIso(l.followUpAt)!,
      href: pipelineHref("lead", l.companyId),
    })),
    ...cvrLeads.map((l) => ({
      key: `cvr-${l.cvrNummer}`,
      name: l.company.navn ?? `CVR ${l.cvrNummer}`,
      date: toFollowUpIso(l.followUpAt)!,
      href: pipelineHref("cvr", l.cvrNummer),
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const payload: NotificationsPayload = {
    items: items.map((n) => ({
      id: n.id,
      actorName: n.actorName,
      text: n.text,
      companyName: n.companyName,
      href: n.href,
      createdAt: n.createdAt.toISOString(),
      unread: n.readAt === null,
    })),
    unread,
    followUps,
  };
  return Response.json(payload);
}

// Marks everything as read — called when the panel is opened.
export async function POST() {
  const ctx = await currentContext();
  if (!ctx) return Response.json({ error: "Ikke logget ind." }, { status: 401 });
  await prisma.notification.updateMany({
    where: { teamId: ctx.teamId, recipientId: ctx.userId, readAt: null },
    data: { readAt: new Date() },
  });
  return Response.json({ ok: true });
}
