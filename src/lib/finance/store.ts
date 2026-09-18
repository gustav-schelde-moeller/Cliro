// Prisma-backed replacement for the handed-off financial-dashboard's local
// JSON-file store (server/src/lib/store.ts) — same function shapes/behavior,
// backed by Postgres (FinTransaction/FinPipelineRow/etc.) instead of files on
// disk, since this now runs as part of Cliro rather than its own process
// with its own persistent volume.
import { prisma } from "@/lib/prisma";
import type { Transaction } from "./parseSparekassen";
import type { PipelineRow, ProspectiveRow, RecurringRow } from "./parseSheets";

export type SalaryEntry = { name: string; monthlyAmount: number };
export type CashPosition = { balance: number | null; asOf: string | null };
export type ImportLogEntry = { source: string; file: string; added: number; skipped: number; at: string };

const DEFAULT_SALARIES: SalaryEntry[] = [
  { name: "Jens", monthlyAmount: 0 },
  { name: "Søren", monthlyAmount: 0 },
  { name: "Sune", monthlyAmount: 0 },
];

async function getSettings() {
  const existing = await prisma.finSettings.findUnique({ where: { id: "singleton" } });
  if (existing) return existing;
  return prisma.finSettings.create({ data: { id: "singleton", salaries: DEFAULT_SALARIES } });
}

export async function loadTransactions(): Promise<Transaction[]> {
  const rows = await prisma.finTransaction.findMany({ orderBy: { date: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    source: "sparekassen",
    date: r.date,
    description: r.description,
    counterparty: r.counterparty ?? undefined,
    amount: r.amount,
    category: r.category,
  }));
}

export async function mergeTransactions(newTxs: Transaction[]): Promise<{ added: number; skipped: number; total: number }> {
  const existingIds = new Set((await prisma.finTransaction.findMany({ select: { id: true } })).map((r) => r.id));
  let added = 0;
  let skipped = 0;
  const toInsert: Transaction[] = [];
  for (const tx of newTxs) {
    if (existingIds.has(tx.id)) {
      skipped++;
      continue;
    }
    existingIds.add(tx.id);
    toInsert.push(tx);
    added++;
  }
  if (toInsert.length) {
    await prisma.finTransaction.createMany({ data: toInsert, skipDuplicates: true });
  }
  const total = await prisma.finTransaction.count();
  return { added, skipped, total };
}

export async function loadPipeline(): Promise<PipelineRow[]> {
  return prisma.finPipelineRow.findMany();
}
export async function savePipeline(rows: PipelineRow[]) {
  await prisma.finPipelineRow.deleteMany({});
  if (rows.length) await prisma.finPipelineRow.createMany({ data: rows });
}

export async function loadProspective(): Promise<ProspectiveRow[]> {
  return prisma.finProspectiveRow.findMany();
}
export async function saveProspective(rows: ProspectiveRow[]) {
  await prisma.finProspectiveRow.deleteMany({});
  if (rows.length) await prisma.finProspectiveRow.createMany({ data: rows });
}

export async function loadRecurring(): Promise<RecurringRow[]> {
  return prisma.finRecurringRow.findMany();
}
export async function saveRecurring(rows: RecurringRow[]) {
  await prisma.finRecurringRow.deleteMany({});
  if (rows.length) await prisma.finRecurringRow.createMany({ data: rows });
}

export async function loadLastSheetSync(): Promise<string | null> {
  const settings = await getSettings();
  return settings.lastSheetSync ? settings.lastSheetSync.toISOString() : null;
}
export async function saveLastSheetSync(iso: string) {
  await prisma.finSettings.upsert({
    where: { id: "singleton" },
    update: { lastSheetSync: new Date(iso) },
    create: { id: "singleton", salaries: DEFAULT_SALARIES, lastSheetSync: new Date(iso) },
  });
}

export async function loadImports(): Promise<ImportLogEntry[]> {
  const rows = await prisma.finImportLog.findMany({ orderBy: { at: "desc" } });
  return rows.map((r) => ({ source: r.source, file: r.file, added: r.added, skipped: r.skipped, at: r.at.toISOString() }));
}
export async function recordImport(entry: { source: string; file: string; added: number; skipped: number }) {
  await prisma.finImportLog.create({ data: entry });
}

export async function loadCashPosition(): Promise<CashPosition> {
  const settings = await getSettings();
  return { balance: settings.cashBalance, asOf: settings.cashAsOf ? settings.cashAsOf.toISOString() : null };
}
export async function saveCashPosition(balance: number): Promise<CashPosition> {
  const asOf = new Date();
  await prisma.finSettings.upsert({
    where: { id: "singleton" },
    update: { cashBalance: balance, cashAsOf: asOf },
    create: { id: "singleton", salaries: DEFAULT_SALARIES, cashBalance: balance, cashAsOf: asOf },
  });
  return { balance, asOf: asOf.toISOString() };
}

export async function loadSalaries(): Promise<SalaryEntry[]> {
  const settings = await getSettings();
  return (settings.salaries as SalaryEntry[] | null) ?? DEFAULT_SALARIES;
}
export async function saveSalaries(entries: SalaryEntry[]): Promise<SalaryEntry[]> {
  await prisma.finSettings.upsert({
    where: { id: "singleton" },
    update: { salaries: entries },
    create: { id: "singleton", salaries: entries },
  });
  return entries;
}
