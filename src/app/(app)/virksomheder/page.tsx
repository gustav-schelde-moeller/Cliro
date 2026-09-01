import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getActiveTeamId } from "@/lib/session-team";
import { getTeamLeadsMap, getUserStars } from "@/lib/queries";
import { getCompanies } from "@/lib/companies";
import { VirksomhederView } from "@/components/leads/VirksomhederView";

export default async function VirksomhederPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const teamId = await getActiveTeamId(session.user.id);
  if (!teamId) redirect("/team-gate");

  const [COMPANIES, leadsMap, stars] = await Promise.all([
    getCompanies(),
    getTeamLeadsMap(teamId),
    getUserStars(session.user.id),
  ]);

  const leadsPlain = Object.fromEntries(leadsMap);
  const starsPlain = Array.from(stars);

  return (
    <VirksomhederView
      companies={COMPANIES}
      teamId={teamId}
      myName={session.user.name ?? "Ukendt"}
      initialLeads={leadsPlain}
      initialStars={starsPlain}
    />
  );
}
