import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getActiveTeamId } from "@/lib/session-team";
import { TeamGateScreen } from "@/components/auth/TeamGateScreen";

export default async function TeamGatePage({
  searchParams,
}: {
  searchParams: Promise<{ join?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const activeTeamId = await getActiveTeamId(session.user.id);
  if (activeTeamId) {
    redirect("/virksomheder");
  }

  const { join } = await searchParams;
  return <TeamGateScreen prefillCode={join ?? null} />;
}
