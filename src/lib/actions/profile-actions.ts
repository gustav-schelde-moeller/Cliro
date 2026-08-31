"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
