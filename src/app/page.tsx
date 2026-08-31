import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getActiveTeamId } from "@/lib/session-team";

export default async function RootPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const activeTeamId = await getActiveTeamId(session.user.id);
  if (!activeTeamId) {
    redirect("/team-gate");
  }

  redirect("/virksomheder");
}
