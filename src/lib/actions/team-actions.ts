"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { genTeamCode } from "@/lib/team-code";
import { setActiveTeamId, clearActiveTeamId } from "@/lib/session-team";
import { sendEmail, inviteEmail } from "@/lib/email";

export type ActionResult = { error?: string; ok?: boolean };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Ikke logget ind.");
  return session.user as { id: string; name?: string | null; email?: string | null };
}

async function getMembershipContext(teamId: string, userId: string) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return null;
  const membership = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });
  return { team, membership, isOwner: team.ownerId === userId, isAdmin: membership?.role === "admin" };
}

export async function createTeamAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Giv teamet et navn." };

  let teamId: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const team = await prisma.team.create({
        data: {
          name,
          code: genTeamCode(),
          ownerId: user.id,
          members: { create: { userId: user.id, role: "admin" } },
        },
      });
      teamId = team.id;
      break;
    } catch {
      // Unique code collision (astronomically rare with 6 chars) — retry with a fresh code.
      continue;
    }
  }
  if (!teamId) return { error: "Kunne ikke oprette teamet. Prøv igen." };

  await setActiveTeamId(teamId);
  redirect("/virksomheder");
}

const joinSchema = z.object({ code: z.string().trim().toUpperCase().min(1) });

export async function joinTeamAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = joinSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { error: "Indtast en kode." };

  const team = await prisma.team.findUnique({ where: { code: parsed.data.code } });
  if (!team) return { error: "Ingen team fundet med den kode." };

  const existing = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: team.id, userId: user.id } },
  });
  if (!existing) {
    await prisma.teamMember.create({ data: { teamId: team.id, userId: user.id, role: "member" } });
    await prisma.activityLog.create({
      data: { teamId: team.id, userId: user.id, who: user.name ?? "Ukendt", action: "tilsluttede sig teamet" },
    });
  }

  await setActiveTeamId(team.id);
  redirect("/virksomheder");
}

export async function leaveTeamAction(teamId: string) {
  const user = await requireUser();
  const ctx = await getMembershipContext(teamId, user.id);
  if (!ctx || !ctx.membership) throw new Error("Du er ikke medlem af det team.");
  if (ctx.isOwner) throw new Error("Du er ejer af teamet og kan ikke forlade det — gør et andet medlem til ejer først, eller slet teamet.");

  await prisma.teamMember.delete({ where: { teamId_userId: { teamId, userId: user.id } } });
  await prisma.lead.updateMany({ where: { teamId, assigneeId: user.id }, data: { assigneeId: null } });
  await clearActiveTeamId();
  redirect("/");
}

export async function switchTeamAction(teamId: string) {
  const user = await requireUser();
  const membership = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: user.id } } });
  if (!membership) throw new Error("Du er ikke medlem af det team.");
  await setActiveTeamId(teamId);
  redirect("/virksomheder");
}

const inviteEmailSchema = z.object({ email: z.string().trim().toLowerCase().email() });

export async function inviteEmailAction(
  teamId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireUser();
  const ctx = await getMembershipContext(teamId, user.id);
  if (!ctx || !ctx.isAdmin) return { error: "Kun admins kan invitere." };

  const parsed = inviteEmailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Indtast en gyldig emailadresse." };

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const joinUrl = `${baseUrl}/team-gate?join=${ctx.team.code}`;
  const { subject, html, text } = inviteEmail({
    inviterName: user.name ?? "En kollega",
    teamName: ctx.team.name,
    code: ctx.team.code,
    joinUrl,
  });
  const result = await sendEmail({ to: parsed.data.email, subject, html, text });

  if (!result.sent) {
    if (result.reason === "not_configured") {
      return { error: "Kunne ikke sende mailen — RESEND_API_KEY er ikke sat endnu (se README)." };
    }
    return { error: `Kunne ikke sende mailen: ${result.message}` };
  }
  return { ok: true };
}

export async function removeMemberAction(teamId: string, targetUserId: string) {
  const user = await requireUser();
  const ctx = await getMembershipContext(teamId, user.id);
  if (!ctx || !ctx.isAdmin) throw new Error("Kun admins kan fjerne medlemmer.");
  if (targetUserId === ctx.team.ownerId) throw new Error("Du kan ikke fjerne teamets ejer.");
  if (targetUserId === user.id) throw new Error("Du kan ikke fjerne dig selv herfra.");

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  await prisma.teamMember.delete({ where: { teamId_userId: { teamId, userId: targetUserId } } });
  await prisma.lead.updateMany({ where: { teamId, assigneeId: targetUserId }, data: { assigneeId: null } });
  await prisma.activityLog.create({
    data: {
      teamId,
      userId: user.id,
      who: user.name ?? "Ukendt",
      action: `fjernede ${target?.name ?? "et medlem"} fra teamet`,
    },
  });
  revalidatePath("/team");
}

export async function setRoleAction(teamId: string, targetUserId: string, makeAdmin: boolean) {
  const user = await requireUser();
  const ctx = await getMembershipContext(teamId, user.id);
  if (!ctx || !ctx.isOwner) throw new Error("Kun teamets ejer kan ændre roller.");
  if (targetUserId === ctx.team.ownerId) throw new Error("Ejeren har altid admin-rettigheder.");

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  await prisma.teamMember.update({
    where: { teamId_userId: { teamId, userId: targetUserId } },
    data: { role: makeAdmin ? "admin" : "member" },
  });
  await prisma.activityLog.create({
    data: {
      teamId,
      userId: user.id,
      who: user.name ?? "Ukendt",
      action: makeAdmin
        ? `gjorde ${target?.name ?? "et medlem"} til admin`
        : `fjernede admin-rettigheder fra ${target?.name ?? "et medlem"}`,
    },
  });
  revalidatePath("/team");
}
