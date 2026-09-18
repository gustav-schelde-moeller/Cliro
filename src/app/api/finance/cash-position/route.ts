import { auth } from "@/lib/auth";
import { loadCashPosition, saveCashPosition } from "@/lib/finance/store";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(await loadCashPosition());
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const balance = Number(body?.balance);
  if (!Number.isFinite(balance)) {
    return Response.json({ error: 'Expected numeric "balance" in body.' }, { status: 400 });
  }

  return Response.json(await saveCashPosition(balance));
}
