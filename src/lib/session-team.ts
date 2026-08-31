import { cookies } from "next/headers";
import { prisma } from "./prisma";

// Which team a signed-in user is currently viewing. A user can belong to
// several teams (TeamMember rows — the owner also gets one, role "admin");
// this cookie just remembers which one is active in the UI right now. It's
// re-validated against real membership on every read, so a stale/forged
// cookie can never grant access to a team you're not actually in.
const COOKIE_NAME = "cliro_active_team";

export async function getActiveTeamId(userId: string): Promise<string | null> {
  const cookieStore = await cookies();
  const cookieTeamId = cookieStore.get(COOKIE_NAME)?.value;

  if (cookieTeamId) {
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: cookieTeamId, userId } },
    });
    if (membership) return cookieTeamId;
  }

  const membership = await prisma.teamMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: "desc" },
  });
  return membership?.teamId ?? null;
}

export async function setActiveTeamId(teamId: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, teamId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearActiveTeamId() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
