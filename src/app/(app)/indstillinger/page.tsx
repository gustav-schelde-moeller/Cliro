import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveTeamId } from "@/lib/session-team";
import { getTeamWithRole } from "@/lib/queries";
import { IndstillingerView } from "@/components/settings/IndstillingerView";

export default async function IndstillingerPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const teamId = await getActiveTeamId(session.user.id);
  if (!teamId) redirect("/team-gate");

  const [user, ctx] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    getTeamWithRole(teamId, session.user.id),
  ]);
  if (!user || !ctx) redirect("/team-gate");

  return (
    <IndstillingerView
      hasPassword={Boolean(user.passwordHash)}
      teamId={teamId}
      teamName={ctx.team.name}
      isOwner={ctx.isOwner}
    />
  );
}
