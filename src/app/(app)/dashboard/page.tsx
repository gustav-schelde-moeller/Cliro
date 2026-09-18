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
} from "@/lib/queries";
import { getCompanies } from "@/lib/companies";
import { STATUS_DEFS } from "@/lib/status";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { DashboardInProgress } from "@/components/dashboard/DashboardInProgress";
import { CvrInProgress } from "@/components/dashboard/CvrInProgress";
import { RegnskabPanel } from "@/components/dashboard/RegnskabPanel";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const teamId = await getActiveTeamId(session.user.id);
  if (!teamId) redirect("/team-gate");

  const [COMPANIES, leadsMap, cvrLeadsMap, starCount, userStars, teamLists, listMembershipsMap] = await Promise.all([
    getCompanies(),
    getTeamLeadsMap(teamId),
    getTeamCvrLeadsMap(teamId),
    prisma.star.count({ where: { userId: session.user.id } }),
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
  const hotCount = COMPANIES.filter((c) => c.tier.key === "hot").length;
  const namedCount = COMPANIES.filter((c) => c.contact.found).length;
  const maxCount = Math.max(1, ...Object.values(counts));

  const activeCompanies = COMPANIES.filter((c) => {
    const lead = leadsMap.get(c.id);
    return lead && (lead.status !== "new" || lead.assigneeId);
  });
  const activeLeads: Record<number, { status: string; assigneeId: string | null; assigneeName: string | null }> = {};
  for (const c of activeCompanies) activeLeads[c.id] = leadsMap.get(c.id)!;

  return (
    <section>
      <DashboardStats total={COMPANIES.length} hot={hotCount} named={namedCount} starred={starCount} won={counts.won} />

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
        <DashboardInProgress
          companies={activeCompanies}
          teamId={teamId}
          myName={session.user.name ?? "Ukendt"}
          initialLeads={activeLeads}
          initialStars={[...userStars]}
          initialTeamLists={teamLists.map((l) => ({ id: l.id, name: l.name }))}
          initialListMemberships={listMembershipsPlain}
        />
      </div>

      <div className="panel-card" style={{ marginTop: 16 }}>
        <h3>CVR-virksomheder i gang</h3>
        <CvrInProgress
          companies={cvrCompanies}
          teamId={teamId}
          myName={session.user.name ?? "Ukendt"}
          initialTeamLists={teamLists.map((l) => ({ id: l.id, name: l.name }))}
        />
      </div>
    </section>
  );
}
