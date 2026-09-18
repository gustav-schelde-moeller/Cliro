import { auth } from "@/lib/auth";
import { loadSalaries, saveSalaries, type SalaryEntry } from "@/lib/finance/store";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(await loadSalaries());
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const entries = body?.salaries;
  if (!Array.isArray(entries) || !entries.every((e) => typeof e?.name === "string" && Number.isFinite(e?.monthlyAmount))) {
    return Response.json({ error: "Expected { salaries: [{ name, monthlyAmount }, ...] }." }, { status: 400 });
  }
  const clean: SalaryEntry[] = entries.map((e) => ({ name: e.name, monthlyAmount: e.monthlyAmount }));

  return Response.json(await saveSalaries(clean));
}
