import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ cvr: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { cvr } = await params;
  const body = await request.json().catch(() => ({}));

  const existing = await prisma.cvrLead.findUnique({ where: { cvrNummer: cvr } });

  // stage can be explicitly cleared by passing stage: null with
  // clearStage: true (the UI needs "un-set" to be reachable, not just
  // "leave unchanged").
  const stage = body.clearStage ? null : (body.stage ?? existing?.stage ?? null);
  const notes = body.notes !== undefined ? body.notes : (existing?.notes ?? null);
  const lastContacted = body.last_contacted !== undefined ? body.last_contacted : (existing?.lastContacted ?? null);
  const starred = body.starred !== undefined ? Boolean(body.starred) : (existing?.starred ?? false);

  const lead = await prisma.cvrLead.upsert({
    where: { cvrNummer: cvr },
    create: { cvrNummer: cvr, stage, notes, lastContacted, starred },
    update: { stage, notes, lastContacted, starred },
  });

  return Response.json(lead);
}
