import { prisma } from "@/lib/prisma";

type NotificationInput = {
  teamId: string;
  actorId: string;
  actorName: string;
  text: string;
  companyName?: string | null;
  href?: string | null;
};

export function pipelineHref(kind: "lead" | "cvr", id: number | string): string {
  return `/pipeline?open=${kind}-${id}`;
}

// Everyone on the team except whoever did it.
export async function notifyTeam(input: NotificationInput) {
  const members = await prisma.teamMember.findMany({
    where: { teamId: input.teamId, userId: { not: input.actorId } },
    select: { userId: true },
  });
  if (members.length === 0) return;
  await prisma.notification.createMany({
    data: members.map((m) => ({
      teamId: input.teamId,
      recipientId: m.userId,
      actorName: input.actorName,
      text: input.text,
      companyName: input.companyName ?? null,
      href: input.href ?? null,
    })),
  });
}

// One person — skipped when there's nobody, or when it's the actor themself.
export async function notifyUser(recipientId: string | null | undefined, input: NotificationInput) {
  if (!recipientId || recipientId === input.actorId) return;
  await prisma.notification.create({
    data: {
      teamId: input.teamId,
      recipientId,
      actorName: input.actorName,
      text: input.text,
      companyName: input.companyName ?? null,
      href: input.href ?? null,
    },
  });
}
