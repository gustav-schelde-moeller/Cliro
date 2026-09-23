import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getActiveTeamId } from "@/lib/session-team";
import {
  getTeamLeadsMap,
  getTeamCvrLeadsMap,
  getUserStars,
  getTeamLists,
  getCompanyListMemberships,
  getCvrCompanyRows,
  type LeadState,
} from "@/lib/queries";
import { getCompanies } from "@/lib/companies";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";

const isActive = (lead: LeadState) => lead.status !== "new" || lead.assigneeId !== null;

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const teamId = await getActiveTeamId(session.user.id);
  if (!teamId) redirect("/team-gate");

  const { open } = await searchParams;
  const openKey = typeof open === "string" ? open : null;

  const [companies, leadsMap, cvrLeadsMap, userStars, teamLists, listMembershipsMap] = await Promise.all([
    getCompanies(),
    getTeamLeadsMap(teamId),
    getTeamCvrLeadsMap(teamId),
    getUserStars(session.user.id),
    getTeamLists(teamId, session.user.id),
    getCompanyListMemberships(teamId, session.user.id),
  ]);
  const activeCvrNummers = [...cvrLeadsMap].filter(([, lead]) => isActive(lead)).map(([cvrNummer]) => cvrNummer);
  const cvrCompanies = await getCvrCompanyRows(teamId, session.user.id, activeCvrNummers);

  const activeCompanies = companies.filter((c) => {
    const lead = leadsMap.get(c.id);
    return lead ? isActive(lead) : false;
  });
  const activeLeads: Record<number, LeadState> = {};
  for (const c of activeCompanies) activeLeads[c.id] = leadsMap.get(c.id)!;
  const listMembershipsPlain = Object.fromEntries(
    Array.from(listMembershipsMap.entries()).map(([companyId, listIds]) => [companyId, Array.from(listIds)]),
  );

  return (
    <PipelineBoard
      // Remounting on a new ?open= target lets the board pick it up as its
      // initial selection — e.g. clicking a notification while already here.
      key={openKey ?? "board"}
      companies={activeCompanies}
      cvrCompanies={cvrCompanies}
      teamId={teamId}
      myName={session.user.name ?? "Ukendt"}
      myUserId={session.user.id}
      initialLeads={activeLeads}
      initialStars={[...userStars]}
      initialTeamLists={teamLists.map((l) => ({ id: l.id, name: l.name }))}
      initialListMemberships={listMembershipsPlain}
      openKey={openKey}
    />
  );
}
