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

function revalidateListPages() {
  revalidatePath("/virksomheder");
  revalidatePath("/lister");
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
