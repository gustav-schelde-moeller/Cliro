import { auth } from "@/lib/auth";
import { getSummary } from "@/lib/finance/summary";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await getSummary();
  return Response.json(summary);
}
