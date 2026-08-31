import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getActiveTeamId } from "@/lib/session-team";
import { getTeamLeadsMap, getActivityLog, getUserStars } from "@/lib/queries";
import { COMPANIES } from "@/lib/companies";
import { STATUS_DEFS } from "@/lib/status";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { DashboardInProgress } from "@/components/dashboard/DashboardInProgress";
import { prisma } from "@/lib/prisma";

function timeAgo(ts: Date): string {
  const diff = Math.max(0, Date.now() - ts.getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "nu";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}t`;
  return `${Math.floor(h / 24)}d`;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const teamId = await getActiveTeamId(session.user.id);
  if (!teamId) redirect("/team-gate");

  const [leadsMap, activity, starCount, userStars] = await Promise.all([
    getTeamLeadsMap(teamId),
    getActivityLog(teamId, 20),
    prisma.star.count({ where: { userId: session.user.id } }),
    getUserStars(session.user.id),
  ]);

  const counts: Record<string, number> = { new: 0, contacted: 0, meeting: 0, won: 0, lost: 0 };
  for (const c of COMPANIES) {
    const status = leadsMap.get(c.id)?.status ?? "new";
    counts[status] = (counts[status] ?? 0) + 1;
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

      <div className="grid-cols">
        <div className="panel-card">
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
        <div className="panel-card">
          <h3>Seneste aktivitet</h3>
          <div className="activity-feed">
            {activity.length === 0 ? (
              <div className="dash-empty">Ingen aktivitet endnu. Tildel en virksomhed eller opdater en status for at komme i gang.</div>
            ) : (
              activity.map((a) => (
                <div className="activity-row" key={a.id}>
                  <span className="activity-time">{timeAgo(a.createdAt)}</span>
                  <span className="activity-text">
                    <b>{a.who}</b> {a.action}
                    {a.companyName ? <b> {a.companyName}</b> : null}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="panel-card" style={{ marginTop: 16 }}>
        <h3>Virksomheder i gang</h3>
        <DashboardInProgress
          companies={activeCompanies}
          teamId={teamId}
          myName={session.user.name ?? "Ukendt"}
          initialLeads={activeLeads}
          initialStars={[...userStars]}
        />
      </div>
    </section>
  );
}
