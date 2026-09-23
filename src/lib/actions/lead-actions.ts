"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCompanyById } from "@/lib/companies";
import { FOLLOW_UP_DATE_RE, formatFollowUpDate } from "@/lib/followup";
import { notifyTeam, notifyUser, pipelineHref } from "@/lib/notifications";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Ikke logget ind.");
  return session.user as { id: string; name?: string | null };
}

async function requireMembership(teamId: string, userId: string) {
  const membership = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });
  if (!membership) throw new Error("Du er ikke medlem af det team.");
  return membership;
}

const STATUS_LABELS: Record<string, string> = {
  new: "Ny",
  contacted: "Kontaktet",
  meeting: "Møde booket",
  won: "Vundet",
  lost: "Afvist",
};

function revalidateTeamPages() {
  revalidatePath("/virksomheder");
  revalidatePath("/dashboard");
  revalidatePath("/team");
  revalidatePath("/pipeline");
}

export async function setLeadStatusAction(teamId: string, companyId: number, status: string) {
  const user = await requireUser();
  await requireMembership(teamId, user.id);
  const company = await getCompanyById(companyId);
  if (!company) throw new Error("Ukendt virksomhed.");

  // A won or lost deal is closed, so its follow-up date shouldn't keep
  // nagging anyone.
  const closed = status === "won" || status === "lost";
  const lead = await prisma.lead.upsert({
    where: { teamId_companyId: { teamId, companyId } },
    update: { status, ...(closed ? { followUpAt: null } : {}) },
    create: { teamId, companyId, status },
  });
  // Moving a company into the pipeline claims it for whoever did it, so it
  // shows up under them on Team — but never takes it from someone who
  // already owns it. The `assigneeId: null` condition makes that check and
  // the claim one atomic write.
  const claimed =
    status !== "new"
      ? (await prisma.lead.updateMany({ where: { teamId, companyId, assigneeId: null }, data: { assigneeId: user.id } })).count > 0
      : false;
  const label = STATUS_LABELS[status] ?? status;
  const actorName = user.name ?? "Ukendt";
  await prisma.activityLog.create({
    data: {
      teamId,
      userId: user.id,
      who: actorName,
      action: `satte status til "${label}"${claimed ? " og tildelte sig selv" : ""} for`,
      companyName: company.name,
    },
  });
  const notification = { teamId, actorId: user.id, actorName, companyName: company.name, href: pipelineHref("lead", companyId) };
  if (status === "meeting" || status === "won") {
    await notifyTeam({ ...notification, text: status === "won" ? "vandt" : "bookede et møde med" });
  } else {
    // `lead.assigneeId` is the owner from before any claim above.
    await notifyUser(lead.assigneeId, { ...notification, text: `satte status til "${label}" på din virksomhed` });
  }
  revalidateTeamPages();
}

export async function setLeadFollowUpAction(teamId: string, companyId: number, date: string | null) {
  const user = await requireUser();
  await requireMembership(teamId, user.id);
  if (date !== null && !FOLLOW_UP_DATE_RE.test(date)) throw new Error("Ugyldig dato.");
  const company = await getCompanyById(companyId);
  if (!company) throw new Error("Ukendt virksomhed.");

  const followUpAt = date ? new Date(`${date}T00:00:00.000Z`) : null;
  const lead = await prisma.lead.upsert({
    where: { teamId_companyId: { teamId, companyId } },
    update: { followUpAt },
    create: { teamId, companyId, followUpAt },
  });
  // Same claim rule as a status change: planning a follow-up means you're
  // working this company, unless someone already owns it.
  const claimed = date
    ? (await prisma.lead.updateMany({ where: { teamId, companyId, assigneeId: null }, data: { assigneeId: user.id } })).count > 0
    : false;
  const actorName = user.name ?? "Ukendt";
  await prisma.activityLog.create({
    data: {
      teamId,
      userId: user.id,
      who: actorName,
      action: date ? `satte opfølgning til ${formatFollowUpDate(date)}${claimed ? " og tildelte sig selv" : ""} for` : "fjernede opfølgningen for",
      companyName: company.name,
    },
  });
  if (date) {
    await notifyUser(lead.assigneeId, {
      teamId,
      actorId: user.id,
      actorName,
      text: `satte opfølgning til ${formatFollowUpDate(date)} på din virksomhed`,
      companyName: company.name,
      href: pipelineHref("lead", companyId),
    });
  }
  revalidateTeamPages();
}

export async function assignToMeAction(teamId: string, companyId: number) {
  const user = await requireUser();
  await requireMembership(teamId, user.id);
  const company = await getCompanyById(companyId);
  if (!company) throw new Error("Ukendt virksomhed.");

  await prisma.lead.upsert({
    where: { teamId_companyId: { teamId, companyId } },
    update: { assigneeId: user.id },
    create: { teamId, companyId, assigneeId: user.id },
  });
  await prisma.activityLog.create({
    data: {
      teamId,
      userId: user.id,
      who: user.name ?? "Ukendt",
      action: "tildelte sig selv",
      companyName: company.name,
    },
  });
  revalidateTeamPages();
}

export async function releaseAssignmentAction(teamId: string, companyId: number) {
  const user = await requireUser();
  await requireMembership(teamId, user.id);
  const company = await getCompanyById(companyId);
  if (!company) throw new Error("Ukendt virksomhed.");

  await prisma.lead.upsert({
    where: { teamId_companyId: { teamId, companyId } },
    update: { assigneeId: null },
    create: { teamId, companyId, assigneeId: null },
  });
  await prisma.activityLog.create({
    data: {
      teamId,
      userId: user.id,
      who: user.name ?? "Ukendt",
      action: "frigav tildelingen for",
      companyName: company.name,
    },
  });
  revalidateTeamPages();
}

export async function toggleStarAction(companyId: number) {
  const user = await requireUser();
  const existing = await prisma.star.findUnique({
    where: { userId_companyId: { userId: user.id, companyId } },
  });
  if (existing) {
    await prisma.star.delete({ where: { id: existing.id } });
  } else {
    await prisma.star.create({ data: { userId: user.id, companyId } });
  }
  revalidatePath("/virksomheder");
  revalidatePath("/dashboard");
}
