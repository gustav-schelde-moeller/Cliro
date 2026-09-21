import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getActiveTeamId } from "@/lib/session-team";
import {
  getTeamWithRole,
  getTeamLeadsMap,
  getTeamCvrLeadsMap,
  getUserStars,
  getTeamLists,
  getCompanyListMemberships,
  getCvrCompanyRows,
} from "@/lib/queries";
import { getCompanies, displayScore, displayTier } from "@/lib/companies";
import { STATUS_DEFS } from "@/lib/status";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { PipelineInProgress } from "@/components/dashboard/PipelineInProgress";
import { RegnskabPanel } from "@/components/dashboard/RegnskabPanel";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const teamId = await getActiveTeamId(session.user.id);
  if (!teamId) redirect("/team-gate");

  // Dashboard shows the team's financial and pipeline picture — regular
  // members don't get a link to it in the sidebar, and can't reach it by
  // URL either.
  const ctx = await getTeamWithRole(teamId, session.user.id);
  if (!ctx) redirect("/team-gate");
  if (!ctx.isAdmin) redirect("/virksomheder");

  const [COMPANIES, leadsMap, cvrLeadsMap, userStars, teamLists, listMembershipsMap] = await Promise.all([
    getCompanies(),
    getTeamLeadsMap(teamId),
    getTeamCvrLeadsMap(teamId),
    getUserStars(session.user.id),
    getTeamLists(teamId, session.user.id),
    getCompanyListMemberships(teamId, session.user.id),
  ]);
  const cvrCompanies = await getCvrCompanyRows(teamId, session.user.id, [...cvrLeadsMap.keys()]);
  const listMembershipsPlain = Object.fromEntries(
    Array.from(listMembershipsMap.entries()).map(([companyId, listIds]) => [companyId, Array.from(listIds)]),
  );

  // CVR's "new" bucket must never mean "all 420k rows" — only companies
  // someone has actually touched (an explicit CvrTeamLead row) count here,
  // same rule DashboardInProgress already applies to untouched AI leads.
  const counts: Record<string, number> = { new: 0, contacted: 0, meeting: 0, won: 0, lost: 0 };
  for (const c of COMPANIES) {
    const status = leadsMap.get(c.id)?.status ?? "new";
    counts[status] = (counts[status] ?? 0) + 1;
  }
  for (const lead of cvrLeadsMap.values()) {
    counts[lead.status] = (counts[lead.status] ?? 0) + 1;
  }
  const maxCount = Math.max(1, ...Object.values(counts));

  // "In progress" (and the stat tiles below) means actually being worked —
  // touched with a real status, or assigned even while still "new". An
  // untouched company sitting at its default "new" with nobody on it was
  // never really "in the pipeline", so it doesn't count here and — if a
  // status gets set back to "new" with no assignee — it drops back out.
  const activeCompanies = COMPANIES.filter((c) => {
    const lead = leadsMap.get(c.id);
    return lead && (lead.status !== "new" || lead.assigneeId);
  });
  const activeLeads: Record<number, { status: string; assigneeId: string | null; assigneeName: string | null }> = {};
  for (const c of activeCompanies) activeLeads[c.id] = leadsMap.get(c.id)!;

  const activeCvrCompanies = cvrCompanies.filter((c) => c.pipeline && (c.pipeline.status !== "new" || c.pipeline.assigneeId));

  const hotCount = activeCompanies.filter((c) => displayTier(displayScore(c)) === "hot").length;
  const totalInPipeline = activeCompanies.length + activeCvrCompanies.length;

  return (
    <section>
      <DashboardStats total={totalInPipeline} hot={hotCount} won={counts.won} />

      <RegnskabPanel />

      <div className="panel-card" style={{ marginTop: 24 }}>
        <h3>Pipeline</h3>
        {STATUS_DEFS.map((s) => {
          const v = counts[s.key] ?? 0;
          const pct = Math.round((v / maxCount) * 100);
          return (
            <div className="bd-row" key={s.key}>
              <span>{s.label}</span>
              <div className="bd-track">
                <div className="bd-fill" style={{ width: `${pct}%`, background: "var(--accent)" }} />
              </div>
              <b>{v}</b>
            </div>
          );
        })}
      </div>

      <div className="panel-card" style={{ marginTop: 16 }}>
        <h3>Virksomheder i gang</h3>
        <PipelineInProgress
          companies={activeCompanies}
          cvrCompanies={activeCvrCompanies}
          teamId={teamId}
          myName={session.user.name ?? "Ukendt"}
          initialLeads={activeLeads}
          initialStars={[...userStars]}
          initialTeamLists={teamLists.map((l) => ({ id: l.id, name: l.name }))}
          initialListMemberships={listMembershipsPlain}
        />
      </div>
    </section>
  );
}
