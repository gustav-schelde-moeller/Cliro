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

async function requireListInTeam(teamId: string, listId: string) {
  const list = await prisma.companyList.findUnique({ where: { id: listId } });
  if (!list || list.teamId !== teamId) throw new Error("Ukendt liste.");
  return list;
}

// Private lists are only visible/actionable by their creator — enforced
// here so a guessed/leaked listId can't be used to read or mutate a list
// the UI never shows to anyone else. A visible (public) list is normally
// editable by any team member too, unless its owner has turned that off
// via teamCanEdit, in which case only the owner can still change it.
function requireListAccess(list: { isPrivate: boolean; createdBy: string; teamCanEdit: boolean }, userId: string) {
  if (list.createdBy === userId) return;
  if (list.isPrivate) throw new Error("Du har ikke adgang til den liste.");
  if (!list.teamCanEdit) throw new Error("Kun listens ejer kan redigere den.");
}

function revalidateListPages() {
  revalidatePath("/virksomheder");
  revalidatePath("/lister");
  revalidatePath("/team");
}

export async function createListAction(teamId: string, name: string): Promise<{ id: string; name: string }> {
  const user = await requireUser();
  await requireMembership(teamId, user.id);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Giv listen et navn.");

  const existing = await prisma.companyList.findUnique({ where: { teamId_name: { teamId, name: trimmed } } });
  if (existing) throw new Error("Der findes allerede en liste med det navn.");

  const list = await prisma.companyList.create({
    data: { teamId, name: trimmed, createdBy: user.id },
  });
  await prisma.activityLog.create({
    data: { teamId, userId: user.id, who: user.name ?? "Ukendt", action: `oprettede listen "${trimmed}"` },
  });
  revalidateListPages();
  return { id: list.id, name: list.name };
}

export async function deleteListAction(teamId: string, listId: string) {
  const user = await requireUser();
  await requireMembership(teamId, user.id);
  const list = await requireListInTeam(teamId, listId);
  requireListAccess(list, user.id);

  await prisma.companyList.delete({ where: { id: listId } });
  await prisma.activityLog.create({
    data: { teamId, userId: user.id, who: user.name ?? "Ukendt", action: `slettede listen "${list.name}"` },
  });
  revalidateListPages();
}

export async function toggleCompanyInListAction(teamId: string, listId: string, companyId: number) {
  const user = await requireUser();
  await requireMembership(teamId, user.id);
  const list = await requireListInTeam(teamId, listId);
  requireListAccess(list, user.id);
  const company = await getCompanyById(companyId);
  if (!company) throw new Error("Ukendt virksomhed.");

  const existing = await prisma.companyListItem.findUnique({
    where: { listId_companyId: { listId, companyId } },
  });

  if (existing) {
    await prisma.companyListItem.delete({ where: { id: existing.id } });
    await prisma.activityLog.create({
      data: {
        teamId,
        userId: user.id,
        who: user.name ?? "Ukendt",
        action: `fjernede fra listen "${list.name}":`,
        companyName: company.name,
      },
    });
  } else {
    await prisma.companyListItem.create({ data: { listId, companyId, addedBy: user.id } });
    await prisma.activityLog.create({
      data: {
        teamId,
        userId: user.id,
        who: user.name ?? "Ukendt",
        action: `tilføjede til listen "${list.name}":`,
        companyName: company.name,
      },
    });
  }
  revalidateListPages();
}

export async function createListAndAddAction(
  teamId: string,
  name: string,
  companyId: number,
): Promise<{ id: string; name: string }> {
  const list = await createListAction(teamId, name);
  await toggleCompanyInListAction(teamId, list.id, companyId);
  return list;
}

export async function toggleListVisibilityAction(teamId: string, listId: string) {
  const user = await requireUser();
  await requireMembership(teamId, user.id);
  const list = await requireListInTeam(teamId, listId);
  if (list.createdBy !== user.id) throw new Error("Kun listens ejer kan ændre synligheden.");

  const updated = await prisma.companyList.update({
    where: { id: listId },
    data: { isPrivate: !list.isPrivate },
  });
  await prisma.activityLog.create({
    data: {
      teamId,
      userId: user.id,
      who: user.name ?? "Ukendt",
      action: updated.isPrivate ? `gjorde listen "${list.name}" privat` : `gjorde listen "${list.name}" synlig for teamet`,
    },
  });
  revalidateListPages();
  return { isPrivate: updated.isPrivate };
}

export async function toggleListTeamEditAction(teamId: string, listId: string) {
  const user = await requireUser();
  await requireMembership(teamId, user.id);
  const list = await requireListInTeam(teamId, listId);
  if (list.createdBy !== user.id) throw new Error("Kun listens ejer kan ændre redigeringsadgangen.");

  const updated = await prisma.companyList.update({
    where: { id: listId },
    data: { teamCanEdit: !list.teamCanEdit },
  });
  await prisma.activityLog.create({
    data: {
      teamId,
      userId: user.id,
      who: user.name ?? "Ukendt",
      action: updated.teamCanEdit
        ? `lod teamet redigere listen "${list.name}"`
        : `gjorde listen "${list.name}" kun redigerbar af ejeren`,
    },
  });
  revalidateListPages();
  return { teamCanEdit: updated.teamCanEdit };
}

export async function toggleCvrCompanyInListAction(teamId: string, listId: string, cvrNummer: string) {
  const user = await requireUser();
  await requireMembership(teamId, user.id);
  const list = await requireListInTeam(teamId, listId);
  requireListAccess(list, user.id);
  const company = await prisma.cvrCompany.findUnique({ where: { cvrNummer } });
  if (!company) throw new Error("Ukendt virksomhed.");

  const existing = await prisma.cvrListItem.findUnique({
    where: { listId_cvrNummer: { listId, cvrNummer } },
  });

  if (existing) {
    await prisma.cvrListItem.delete({ where: { id: existing.id } });
    await prisma.activityLog.create({
      data: {
        teamId,
        userId: user.id,
        who: user.name ?? "Ukendt",
        action: `fjernede fra listen "${list.name}":`,
        companyName: company.navn ?? `CVR ${cvrNummer}`,
      },
    });
  } else {
    await prisma.cvrListItem.create({ data: { listId, cvrNummer, addedBy: user.id } });
    await prisma.activityLog.create({
      data: {
        teamId,
        userId: user.id,
        who: user.name ?? "Ukendt",
        action: `tilføjede til listen "${list.name}":`,
        companyName: company.navn ?? `CVR ${cvrNummer}`,
      },
    });
  }
  revalidateListPages();
}

export async function createCvrListAndAddAction(
  teamId: string,
  name: string,
  cvrNummer: string,
): Promise<{ id: string; name: string }> {
  const list = await createListAction(teamId, name);
  await toggleCvrCompanyInListAction(teamId, list.id, cvrNummer);
  return list;
}
