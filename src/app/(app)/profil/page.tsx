import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveTeamId } from "@/lib/session-team";
import { ProfilView } from "@/components/profile/ProfilView";

export default async function ProfilPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user, teamId] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    getActiveTeamId(session.user.id),
  ]);
  if (!user) redirect("/login");

  const team = teamId ? await prisma.team.findUnique({ where: { id: teamId } }) : null;

  return <ProfilView name={user.name} email={user.email} avatarDataUrl={user.avatarDataUrl} teamName={team?.name ?? "—"} />;
}
