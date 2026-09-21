import ExcelJS from "exceljs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { displayScore, getCompanies } from "@/lib/companies";

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
  if (list.isPrivate && list.createdBy !== session.user.id) {
    return Response.json({ error: "Du har ikke adgang til den liste." }, { status: 403 });
  }

  const [items, cvrItems] = await Promise.all([
    prisma.companyListItem.findMany({ where: { listId }, select: { companyId: true } }),
    prisma.cvrListItem.findMany({ where: { listId }, select: { company: true } }),
  ]);
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

  // One sheet for both AI leads and CVR-search companies — an earlier
  // version put CVR rows on a separate "CVR" tab, which was easy to miss
  // entirely (a person opening the file just sees the first sheet). Score
  // vs Købekraft and Kontaktperson vs Telefon are kept as separate columns
  // rather than merged into one ambiguous column — same reasoning as the
  // in-app list table, which splits these for the same two row types.
  sheet.columns = [
    { header: "Navn", key: "name", width: 28 },
    { header: "Branche", key: "industry", width: 24 },
    { header: "By", key: "city", width: 16 },
    { header: "Score", key: "score", width: 9 },
    { header: "Købekraft", key: "koebekraft", width: 11 },
    { header: "Kontaktperson", key: "contactName", width: 22 },
    { header: "Titel", key: "contactTitle", width: 20 },
    { header: "Telefon", key: "telefon", width: 15 },
    { header: "Email", key: "email", width: 30 },
    { header: "CVR-nummer", key: "cvrNummer", width: 13 },
    { header: "Ansatte", key: "employees", width: 9 },
    { header: "Adresse", key: "adresse", width: 26 },
    { header: "Note", key: "note", width: 30 },
    { header: "Hjemmeside", key: "website", width: 22 },
    { header: "Nyhed", key: "hook", width: 36 },
    { header: "Nyhedsdato", key: "hookDate", width: 16 },
  ];

  // Spreadsheet apps render on a white canvas regardless of the viewer's own
  // dark/light theme preference — colors here need to be legible against
  // white, not matched to the app's own dark UI (an earlier version used a
  // near-black alternating row fill with default black text, which was
  // nearly unreadable).
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F55FC" } };
  headerRow.alignment = { vertical: "middle" };
  headerRow.height = 22;
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };

  companies.forEach((c) => {
    sheet.addRow({
      name: c.name,
      industry: c.industry,
      city: c.city,
      score: displayScore(c),
      koebekraft: "",
      contactName: c.contact.name ?? "",
      contactTitle: c.contact.title ?? "",
      telefon: "",
      email: c.contact.email ?? "",
      cvrNummer: "",
      employees: "",
      adresse: "",
      note: c.contact.note ?? "",
      website: c.website,
      hook: c.hook.title,
      hookDate: c.hook.date,
    });
  });

  cvrItems.forEach(({ company: c }) => {
    sheet.addRow({
      name: c.navn ?? "",
      industry: c.brancheTekst ?? "",
      city: c.region ?? "",
      score: "",
      koebekraft: c.koebekraftScore ?? "",
      contactName: "",
      contactTitle: "",
      telefon: c.telefon ?? "",
      email: c.email ?? "",
      cvrNummer: c.cvrNummer,
      employees: c.employees ?? "",
      adresse: [c.vejnavn, c.husnummer].filter(Boolean).join(" "),
      note: "",
      website: "",
      hook: "",
      hookDate: "",
    });
  });

  sheet.eachRow((row, i) => {
    if (i === 1) return;
    row.font = { color: { argb: "FF1A1D24" } };
    row.alignment = { vertical: "top", wrapText: true };
    row.height = 30;
    if (i % 2 === 0) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F3F5" } };
    }
    row.eachCell((cell) => {
      cell.border = { bottom: { style: "thin", color: { argb: "FFE2E5E9" } } };
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
