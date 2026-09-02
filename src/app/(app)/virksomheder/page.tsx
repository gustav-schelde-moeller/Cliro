import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getActiveTeamId } from "@/lib/session-team";
import { getTeamLeadsMap, getUserStars, getTeamLists, getCompanyListMemberships } from "@/lib/queries";
import { getCompanies } from "@/lib/companies";
import { VirksomhederView } from "@/components/leads/VirksomhederView";

export default async function VirksomhederPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const teamId = await getActiveTeamId(session.user.id);
  if (!teamId) redirect("/team-gate");

  const [COMPANIES, leadsMap, stars, teamLists, listMembershipsMap] = await Promise.all([
    getCompanies(),
    getTeamLeadsMap(teamId),
    getUserStars(session.user.id),
    getTeamLists(teamId),
    getCompanyListMemberships(teamId),
  ]);

  const leadsPlain = Object.fromEntries(leadsMap);
  const starsPlain = Array.from(stars);
  const listMembershipsPlain = Object.fromEntries(
    Array.from(listMembershipsMap.entries()).map(([companyId, listIds]) => [companyId, Array.from(listIds)]),
  );

  return (
    <VirksomhederView
      companies={COMPANIES}
      teamId={teamId}
      myName={session.user.name ?? "Ukendt"}
      initialLeads={leadsPlain}
      initialStars={starsPlain}
      initialTeamLists={teamLists.map((l) => ({ id: l.id, name: l.name }))}
      initialListMemberships={listMembershipsPlain}
    />
  );
}
