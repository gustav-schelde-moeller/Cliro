import ExcelJS from "exceljs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCompanies } from "@/lib/companies";

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

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Cliro";
  workbook.created = new Date();

  const sheetName = list.name.slice(0, 31).replace(/[[\]*?:/\\]/g, " ") || "Liste";
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Navn", key: "name", width: 26 },
    { header: "Branche", key: "industry", width: 20 },
    { header: "By", key: "city", width: 16 },
    { header: "Score", key: "score", width: 9 },
    { header: "Kontaktperson", key: "contactName", width: 22 },
    { header: "Titel", key: "contactTitle", width: 22 },
    { header: "Email", key: "email", width: 30 },
    { header: "Note", key: "note", width: 34 },
    { header: "Hjemmeside", key: "website", width: 22 },
    { header: "Nyhed", key: "hook", width: 40 },
    { header: "Nyhedsdato", key: "hookDate", width: 18 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F55FC" } };
  headerRow.alignment = { vertical: "middle" };
  headerRow.height = 22;
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };

  companies.forEach((c, i) => {
    const row = sheet.addRow({
      name: c.name,
      industry: c.industry,
      city: c.city,
      score: c.score,
      contactName: c.contact.name ?? "",
      contactTitle: c.contact.title ?? "",
      email: c.contact.email ?? "",
      note: c.contact.note ?? "",
      website: c.website,
      hook: c.hook.title,
      hookDate: c.hook.date,
    });
    row.alignment = { vertical: "top", wrapText: true };
    if (i % 2 === 1) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF171B24" } };
    }
  });

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        bottom: { style: "thin", color: { argb: "FF2A2E38" } },
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const safeName = list.name.replace(/[^\p{L}\p{N}_-]+/gu, "_") || "Liste";
  // Content-Disposition filenames are limited to ISO-8859-1 for the plain
  // `filename` param — non-Latin1 characters (æøå etc.) need the RFC 5987
  // filename* form, or browsers show mojibake instead of the real name.
  const asciiFallback = safeName.replace(/[^\x00-\x7F]/g, "_");
  const encodedName = encodeURIComponent(safeName);

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${asciiFallback}.xlsx"; filename*=UTF-8''${encodedName}.xlsx`,
    },
  });
}
