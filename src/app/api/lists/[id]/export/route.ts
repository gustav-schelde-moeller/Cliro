import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCompanies } from "@/lib/companies";

function csvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function toCsvRow(fields: string[]): string {
  return fields.map(csvField).join(",");
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: listId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Ikke logget ind." }, { status: 401 });
  }

  const list = await prisma.companyList.findUnique({ where: { id: listId } });
  if (!list) {
    return Response.json({ error: "Ukendt liste." }, { status: 404 });
  }

  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: list.teamId, userId: session.user.id } },
  });
  if (!membership) {
    return Response.json({ error: "Du er ikke medlem af det team." }, { status: 403 });
  }

  const items = await prisma.companyListItem.findMany({ where: { listId }, select: { companyId: true } });
  const companyIds = new Set(items.map((i) => i.companyId));
  const allCompanies = await getCompanies();
  const companies = allCompanies.filter((c) => companyIds.has(c.id));

  const header = toCsvRow([
    "Navn",
    "Branche",
    "By",
    "Score",
    "Kontaktperson",
    "Titel",
    "Email",
    "Note",
    "Hjemmeside",
    "Nyhed",
    "Nyhedsdato",
  ]);
  const rows = companies.map((c) =>
    toCsvRow([
      c.name,
      c.industry,
      c.city,
      String(c.score),
      c.contact.name ?? "",
      c.contact.title ?? "",
      c.contact.email ?? "",
      c.contact.note ?? "",
      c.website,
      c.hook.title,
      c.hook.date,
    ]),
  );
  const csv = "﻿" + [header, ...rows].join("\r\n");

  const filename = `${list.name.replace(/[^\p{L}\p{N}_-]+/gu, "_")}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
