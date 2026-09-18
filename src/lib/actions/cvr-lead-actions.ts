"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  await prisma.cvrTeamLead.upsert({
    where: { teamId_cvrNummer: { teamId, cvrNummer } },
    update: { status },
    create: { teamId, cvrNummer, status },
  });
  await prisma.activityLog.create({
    data: {
      teamId,
      userId: user.id,
      who: user.name ?? "Ukendt",
      action: `satte status til "${STATUS_LABELS[status] ?? status}" for`,
      companyName: company.navn ?? `CVR ${cvrNummer}`,
    },
  });
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
