import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getActiveTeamId } from "@/lib/session-team";
import { getListsWithCompanies, getTeamLeadsMap, getUserStars, getCompanyListMemberships } from "@/lib/queries";
import { ListsView } from "@/components/lists/ListsView";

export default async function ListerPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const teamId = await getActiveTeamId(session.user.id);
  if (!teamId) redirect("/team-gate");

  const [lists, leadsMap, stars, listMembershipsMap] = await Promise.all([
    getListsWithCompanies(teamId),
    getTeamLeadsMap(teamId),
    getUserStars(session.user.id),
    getCompanyListMemberships(teamId),
  ]);

  const listMembershipsPlain = Object.fromEntries(
    Array.from(listMembershipsMap.entries()).map(([companyId, listIds]) => [companyId, Array.from(listIds)]),
  );

  return (
    <ListsView
      teamId={teamId}
      myName={session.user.name ?? "Ukendt"}
      lists={lists.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() }))}
      initialLeads={Object.fromEntries(leadsMap)}
      initialStars={Array.from(stars)}
      initialTeamLists={lists.map((l) => ({ id: l.id, name: l.name }))}
      initialListMemberships={listMembershipsPlain}
    />
  );
}
