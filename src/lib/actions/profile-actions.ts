"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clearActiveTeamId } from "@/lib/session-team";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Ikke logget ind.");
  return session.user as { id: string };
}

export async function updateNameAction(name: string) {
  const user = await requireUser();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Navn kan ikke være tomt.");
  await prisma.user.update({ where: { id: user.id }, data: { name: trimmed } });
  revalidatePath("/", "layout");
}

export async function updateAvatarAction(dataUrl: string) {
  const user = await requireUser();
  if (!dataUrl.startsWith("data:image/")) throw new Error("Ugyldigt billede.");
  if (dataUrl.length > 300_000) throw new Error("Billedet er for stort.");
  await prisma.user.update({ where: { id: user.id }, data: { avatarDataUrl: dataUrl } });
  revalidatePath("/", "layout");
}

export async function changePasswordAction(currentPassword: string, newPassword: string) {
  const sessionUser = await requireUser();
  if (newPassword.length < 4) throw new Error("Den nye adgangskode skal være mindst 4 tegn.");

  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) throw new Error("Ikke logget ind.");

  if (user.passwordHash) {
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new Error("Forkert nuværende adgangskode.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
}

// Deleting an account can't leave a team without an owner: solo-owned teams
// are removed entirely (cascades to their leads/activity), teams with other
// members get ownership handed to an existing admin (or any member).
export async function deleteAccountAction() {
  const user = await requireUser();

  const ownedTeams = await prisma.team.findMany({
    where: { ownerId: user.id },
    include: { members: true },
  });

  for (const team of ownedTeams) {
    const others = team.members.filter((m) => m.userId !== user.id);
    if (others.length === 0) {
      await prisma.team.delete({ where: { id: team.id } });
    } else {
      const successor = others.find((m) => m.role === "admin") ?? others[0];
      await prisma.$transaction([
        prisma.team.update({ where: { id: team.id }, data: { ownerId: successor.userId } }),
        prisma.teamMember.update({
          where: { teamId_userId: { teamId: team.id, userId: successor.userId } },
          data: { role: "admin" },
        }),
      ]);
    }
  }

  await prisma.user.delete({ where: { id: user.id } });
  await clearActiveTeamId();
  await signOut({ redirectTo: "/login" });
}
