"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

async function requireCvrCompany(cvrNummer: string) {
  const company = await prisma.cvrCompany.findUnique({ where: { cvrNummer } });
  if (!company) throw new Error("Ukendt virksomhed.");
  return company;
}

export async function setCvrLeadStatusAction(teamId: string, cvrNummer: string, status: string) {
  const user = await requireUser();
  await requireMembership(teamId, user.id);
  const company = await requireCvrCompany(cvrNummer);

  // Same closed-deal and claim-on-status-change rules as setLeadStatusAction.
  const closed = status === "won" || status === "lost";
  const lead = await prisma.cvrTeamLead.upsert({
    where: { teamId_cvrNummer: { teamId, cvrNummer } },
    update: { status, ...(closed ? { followUpAt: null } : {}) },
    create: { teamId, cvrNummer, status },
  });
  const claimed =
    status !== "new"
      ? (await prisma.cvrTeamLead.updateMany({ where: { teamId, cvrNummer, assigneeId: null }, data: { assigneeId: user.id } })).count > 0
      : false;
  const label = STATUS_LABELS[status] ?? status;
  const actorName = user.name ?? "Ukendt";
  const companyName = company.navn ?? `CVR ${cvrNummer}`;
  await prisma.activityLog.create({
    data: {
      teamId,
      userId: user.id,
      who: actorName,
      action: `satte status til "${label}"${claimed ? " og tildelte sig selv" : ""} for`,
      companyName,
    },
  });
  const notification = { teamId, actorId: user.id, actorName, companyName, href: pipelineHref("cvr", cvrNummer) };
  if (status === "meeting" || status === "won") {
    await notifyTeam({ ...notification, text: status === "won" ? "vandt" : "bookede et møde med" });
  } else {
    await notifyUser(lead.assigneeId, { ...notification, text: `satte status til "${label}" på din virksomhed` });
  }
  revalidateTeamPages();
}

export async function setCvrFollowUpAction(teamId: string, cvrNummer: string, date: string | null) {
  const user = await requireUser();
  await requireMembership(teamId, user.id);
  if (date !== null && !FOLLOW_UP_DATE_RE.test(date)) throw new Error("Ugyldig dato.");
  const company = await requireCvrCompany(cvrNummer);

  const followUpAt = date ? new Date(`${date}T00:00:00.000Z`) : null;
  const lead = await prisma.cvrTeamLead.upsert({
    where: { teamId_cvrNummer: { teamId, cvrNummer } },
    update: { followUpAt },
    create: { teamId, cvrNummer, followUpAt },
  });
  const claimed = date
    ? (await prisma.cvrTeamLead.updateMany({ where: { teamId, cvrNummer, assigneeId: null }, data: { assigneeId: user.id } })).count > 0
    : false;
  const actorName = user.name ?? "Ukendt";
  const companyName = company.navn ?? `CVR ${cvrNummer}`;
  await prisma.activityLog.create({
    data: {
      teamId,
      userId: user.id,
      who: actorName,
      action: date ? `satte opfølgning til ${formatFollowUpDate(date)}${claimed ? " og tildelte sig selv" : ""} for` : "fjernede opfølgningen for",
      companyName,
    },
  });
  if (date) {
    await notifyUser(lead.assigneeId, {
      teamId,
      actorId: user.id,
      actorName,
      text: `satte opfølgning til ${formatFollowUpDate(date)} på din virksomhed`,
      companyName,
      href: pipelineHref("cvr", cvrNummer),
    });
  }
  revalidateTeamPages();
}

export async function assignCvrToMeAction(teamId: string, cvrNummer: string) {
  const user = await requireUser();
  await requireMembership(teamId, user.id);
  const company = await requireCvrCompany(cvrNummer);

  await prisma.cvrTeamLead.upsert({
    where: { teamId_cvrNummer: { teamId, cvrNummer } },
    update: { assigneeId: user.id },
    create: { teamId, cvrNummer, assigneeId: user.id },
  });
  await prisma.activityLog.create({
    data: {
      teamId,
      userId: user.id,
      who: user.name ?? "Ukendt",
      action: "tildelte sig selv",
      companyName: company.navn ?? `CVR ${cvrNummer}`,
    },
  });
  revalidateTeamPages();
}

export async function releaseCvrAssignmentAction(teamId: string, cvrNummer: string) {
  const user = await requireUser();
  await requireMembership(teamId, user.id);
  const company = await requireCvrCompany(cvrNummer);

  await prisma.cvrTeamLead.upsert({
    where: { teamId_cvrNummer: { teamId, cvrNummer } },
    update: { assigneeId: null },
    create: { teamId, cvrNummer, assigneeId: null },
  });
  await prisma.activityLog.create({
    data: {
      teamId,
      userId: user.id,
      who: user.name ?? "Ukendt",
      action: "frigav tildelingen for",
      companyName: company.navn ?? `CVR ${cvrNummer}`,
    },
  });
  revalidateTeamPages();
}

export async function toggleCvrStarAction(cvrNummer: string) {
  const user = await requireUser();
  const existing = await prisma.cvrStar.findUnique({
    where: { userId_cvrNummer: { userId: user.id, cvrNummer } },
  });
  if (existing) {
    await prisma.cvrStar.delete({ where: { id: existing.id } });
  } else {
    await prisma.cvrStar.create({ data: { userId: user.id, cvrNummer } });
  }
  revalidatePath("/virksomheder");
  revalidatePath("/dashboard");
}
