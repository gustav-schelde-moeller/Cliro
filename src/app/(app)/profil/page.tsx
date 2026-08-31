import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveTeamId } from "@/lib/session-team";
import { getTeamWithRole } from "@/lib/queries";
import { ProfilView } from "@/components/profile/ProfilView";

export default async function ProfilPage() {
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
    <ProfilView
      name={user.name}
      email={user.email}
      avatarDataUrl={user.avatarDataUrl}
      teamId={teamId}
      teamName={ctx.team.name}
      isOwner={ctx.isOwner}
    />
  );
}
