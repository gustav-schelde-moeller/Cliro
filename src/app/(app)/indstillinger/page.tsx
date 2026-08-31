import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { IndstillingerView } from "@/components/settings/IndstillingerView";

export default async function IndstillingerPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  return <IndstillingerView hasPassword={Boolean(user.passwordHash)} />;
}
