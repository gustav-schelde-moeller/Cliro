import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getActiveTeamId } from "@/lib/session-team";
import {
  getTeamWithRole,
  getTeamMembers,
  getTeamLeadsMap,
  getTeamCvrLeadsMap,
  getCvrCompanyRows,
  getActivityLog,
  getPublicTeamLists,
} from "@/lib/queries";
import { getCompanies } from "@/lib/companies";
import { TeamView } from "@/components/team/TeamView";

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const teamId = await getActiveTeamId(session.user.id);
  if (!teamId) redirect("/team-gate");

  const ctx = await getTeamWithRole(teamId, session.user.id);
  if (!ctx) redirect("/team-gate");

  const [COMPANIES, members, leadsMap, cvrLeadsMap, activity, publicLists] = await Promise.all([
    getCompanies(),
    getTeamMembers(teamId, ctx.team.ownerId),
    getTeamLeadsMap(teamId),
    getTeamCvrLeadsMap(teamId),
    getActivityLog(teamId, 60),
    getPublicTeamLists(teamId),
  ]);
  const cvrCompanies = await getCvrCompanyRows(teamId, session.user.id, [...cvrLeadsMap.keys()]);
  const cvrCompanyByNummer = new Map(cvrCompanies.map((c) => [c.cvrNummer, c]));

  const byMemberName: Record<string, { total: number; won: number; meeting: number }> = {};
  for (const c of COMPANIES) {
    const lead = leadsMap.get(c.id);
    if (lead?.assigneeName) {
      byMemberName[lead.assigneeName] = byMemberName[lead.assigneeName] || { total: 0, won: 0, meeting: 0 };
      byMemberName[lead.assigneeName].total++;
      if (lead.status === "won") byMemberName[lead.assigneeName].won++;
      if (lead.status === "meeting") byMemberName[lead.assigneeName].meeting++;
    }
  }
  for (const lead of cvrLeadsMap.values()) {
    if (lead.assigneeName) {
      byMemberName[lead.assigneeName] = byMemberName[lead.assigneeName] || { total: 0, won: 0, meeting: 0 };
      byMemberName[lead.assigneeName].total++;
      if (lead.status === "won") byMemberName[lead.assigneeName].won++;
      if (lead.status === "meeting") byMemberName[lead.assigneeName].meeting++;
    }
  }

  const memberBreakdown = members.map((m) => ({
    ...m,
    stats: byMemberName[m.name] ?? { total: 0, won: 0, meeting: 0 },
    leads: COMPANIES.filter((c) => leadsMap.get(c.id)?.assigneeId === m.userId).map((c) => ({
      id: c.id,
      name: c.name,
      industry: c.industry,
      status: leadsMap.get(c.id)!.status,
    })),
    cvrLeads: [...cvrLeadsMap.entries()]
      .filter(([, lead]) => lead.assigneeId === m.userId)
      .map(([cvrNummer, lead]) => ({
        cvrNummer,
        name: cvrCompanyByNummer.get(cvrNummer)?.navn ?? `CVR ${cvrNummer}`,
        industry: cvrCompanyByNummer.get(cvrNummer)?.brancheLabel ?? "CVR",
        status: lead.status,
      })),
  }));

  return (
    <TeamView
      teamId={teamId}
      teamName={ctx.team.name}
      teamCode={ctx.team.code}
      isAdmin={ctx.isAdmin}
      isOwner={ctx.isOwner}
      myUserId={session.user.id}
      myName={session.user.name ?? "Ukendt"}
      members={memberBreakdown}
      activity={activity.map((a) => ({ id: a.id, ts: a.createdAt.toISOString(), who: a.who, action: a.action, company: a.companyName }))}
      publicLists={publicLists.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() }))}
    />
  );
}
