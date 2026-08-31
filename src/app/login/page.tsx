import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isGoogleConfigured } from "@/lib/auth";
import { AuthScreen } from "@/components/auth/AuthScreen";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ join?: string }>;
}) {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/");
  }
  const { join } = await searchParams;

  return <AuthScreen joinCode={join ?? null} googleConfigured={isGoogleConfigured} />;
}
