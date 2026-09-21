import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveTeamId } from "@/lib/session-team";
import { getUserTeams, getTeamWithRole } from "@/lib/queries";
import { ToastProvider } from "@/components/shared/ToastProvider";
import { Sidebar } from "@/components/shared/Sidebar";
import { Topbar } from "@/components/shared/Topbar";
import { PageShell } from "@/components/shared/PageShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const activeTeamId = await getActiveTeamId(session.user.id);
  if (!activeTeamId) {
    redirect("/team-gate");
  }

  const [team, user, userTeams, companyCount, ctx] = await Promise.all([
    prisma.team.findUnique({ where: { id: activeTeamId } }),
    prisma.user.findUnique({ where: { id: session.user.id } }),
    getUserTeams(session.user.id),
    prisma.company.count(),
    getTeamWithRole(activeTeamId, session.user.id),
  ]);
  if (!team || !user) {
    redirect("/team-gate");
  }

  return (
    <ToastProvider>
      <div className="app-active" style={{ padding: 16, display: "flex", minHeight: "100vh" }}>
        <div id="appShell" className="show" style={{ display: "grid" }}>
          <Sidebar
            teamName={team.name}
            teamId={team.id}
            userTeams={userTeams}
            companyCount={companyCount}
            isAdmin={ctx?.isAdmin ?? false}
          />
          <div className="main">
            <Topbar name={user.name} avatarDataUrl={user.avatarDataUrl ?? user.image} />
            <div className="pages">
              <PageShell>{children}</PageShell>
            </div>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
