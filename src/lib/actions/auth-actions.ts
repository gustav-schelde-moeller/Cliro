"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail, resetPasswordEmail } from "@/lib/email";
import { clearActiveTeamId } from "@/lib/session-team";

export type ActionResult = { error?: string; ok?: boolean };

const signupSchema = z.object({
  name: z.string().trim().min(1, "Skriv dit navn.").max(60),
  email: z.string().trim().toLowerCase().email("Ugyldig email."),
  password: z.string().min(4, "Adgangskoden skal være mindst 4 tegn."),
});

export async function signupAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ugyldige oplysninger." };
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Der findes allerede en konto med den email." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { name, email, passwordHash } });

  const join = String(formData.get("join") || "").trim();
  const redirectTo = join ? `/team-gate?join=${encodeURIComponent(join)}` : "/";

  try {
    await signIn("credentials", { email, password, redirectTo });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Kontoen blev oprettet, men login fejlede — prøv at logge ind." };
    }
    throw error;
  }
  return { ok: true };
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ugyldig email."),
  password: z.string().min(1, "Skriv din adgangskode."),
});

export async function loginAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ugyldige oplysninger." };
  }
  const join = String(formData.get("join") || "").trim();
  const redirectTo = join ? `/team-gate?join=${encodeURIComponent(join)}` : "/";

  try {
    await signIn("credentials", { ...parsed.data, redirectTo });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Forkert email eller adgangskode." };
    }
    throw error;
  }
  return { ok: true };
}

export async function logoutAction() {
  await clearActiveTeamId();
  await signOut({ redirectTo: "/login" });
}

const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email() });

export async function forgotPasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = forgotSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: "Indtast en gyldig email." };
  }
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  // Always report success even if there's no account — don't leak which
  // emails have accounts.
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    const { subject, html, text } = resetPasswordEmail({ name: user.name, resetUrl });
    await sendEmail({ to: user.email, subject, html, text });
  }

  return { ok: true };
}

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(4, "Adgangskoden skal være mindst 4 tegn."),
});

export async function resetPasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ugyldige oplysninger." };
  }
  const record = await prisma.passwordResetToken.findUnique({ where: { token: parsed.data.token } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { error: "Linket er ugyldigt eller udløbet — bed om et nyt." };
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
  return { ok: true };
}
