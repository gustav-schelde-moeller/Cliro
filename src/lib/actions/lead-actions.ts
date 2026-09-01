"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCompanyById } from "@/lib/companies";

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

export async function setLeadStatusAction(teamId: string, companyId: number, status: string) {
  const user = await requireUser();
  await requireMembership(teamId, user.id);
  const company = await getCompanyById(companyId);
  if (!company) throw new Error("Ukendt virksomhed.");

  await prisma.lead.upsert({
    where: { teamId_companyId: { teamId, companyId } },
    update: { status },
    create: { teamId, companyId, status },
  });
  await prisma.activityLog.create({
    data: {
      teamId,
      userId: user.id,
      who: user.name ?? "Ukendt",
      action: `satte status til "${STATUS_LABELS[status] ?? status}" for`,
      companyName: company.name,
    },
  });
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
