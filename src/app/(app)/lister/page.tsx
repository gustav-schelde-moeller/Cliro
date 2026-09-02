import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getActiveTeamId } from "@/lib/session-team";
import { getListsWithCompanies } from "@/lib/queries";
import { ListsView } from "@/components/lists/ListsView";

export default async function ListerPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const teamId = await getActiveTeamId(session.user.id);
  if (!teamId) redirect("/team-gate");

  const lists = await getListsWithCompanies(teamId);

  return (
    <ListsView
      teamId={teamId}
      lists={lists.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() }))}
    />
  );
}
