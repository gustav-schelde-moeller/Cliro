// Verbatim port of the handed-off financial-dashboard's server/src/lib/parseSheets.ts.
import { parseCsv, parseDanishNumber, parseEuroDate } from "./csv";

export type PipelineRow = {
  date: string;
  client: string;
  status: string;
  segment: string;
  type: string;
  vat: boolean;
  revenue: number;
  vatAmount: number;
  inclVat: number;
};
export type ProspectiveRow = { client: string; segment: string; type: string; status: string; revenue: number };
export type RecurringRow = {
  vendor: string;
  category: string;
  monthlyAmount: number;
  vat: boolean;
  vatAmount: number;
  totalAmount: number;
  startDate: string;
  endDate: string;
};

const PUB_BASE =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQohmOO-Da5xa6Y6kPML8KXtIBTLNn9YAnjUCfwbz442jRfsNhRq8wXFyGbMrRF9DneYGGAzZiNy-w1/pub";

const GIDS = {
  pipeline: "1973802863",
  prospective: "100",
  recurring: "300",
};

async function fetchTabCsv(gid: string, attempt = 1): Promise<string> {
  const url = `${PUB_BASE}?gid=${gid}&single=true&output=csv`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Failed to fetch sheet gid=${gid}: ${res.status}`);
    return await res.text();
  } catch (err) {
    if (attempt < 3) return fetchTabCsv(gid, attempt + 1);
    throw new Error(`Failed to fetch sheet gid=${gid} after ${attempt} attempts: ${err instanceof Error ? err.message : err}`);
  }
}

function boolFromYesNo(v: string | undefined): boolean {
  return (v || "").trim().toLowerCase() === "yes";
}

// Some tabs (Prospective, Recurring expenses) have a fully-blank leading row
// before the real header. Drop any leading all-empty rows, then drop the
// header row itself, so the header never leaks through as a fake data row.
function dataRowsAfterHeader(rows: string[][]): string[][] {
  let i = 0;
  while (i < rows.length && rows[i].every((cell) => !cell.trim())) i++;
  return rows.slice(i + 1);
}

export async function fetchPipeline(): Promise<PipelineRow[]> {
  const csv = await fetchTabCsv(GIDS.pipeline);
  const rows = parseCsv(csv, ",");
  const data = dataRowsAfterHeader(rows);
  const out: PipelineRow[] = [];
  for (const r of data) {
    const client = (r[1] || "").trim();
    if (!client) continue;
    out.push({
      date: parseEuroDate(r[0]),
      client,
      status: (r[2] || "").trim(),
      segment: (r[3] || "").trim(),
      type: (r[4] || "").trim(),
      vat: boolFromYesNo(r[5]),
      revenue: parseDanishNumber(r[6]),
      vatAmount: parseDanishNumber(r[7]),
      inclVat: parseDanishNumber(r[8]),
    });
  }
  return out;
}

export async function fetchProspective(): Promise<ProspectiveRow[]> {
  const csv = await fetchTabCsv(GIDS.prospective);
  const rows = parseCsv(csv, ",");
  const data = dataRowsAfterHeader(rows);
  const out: ProspectiveRow[] = [];
  for (const r of data) {
    const client = (r[0] || "").trim();
    if (!client) continue;
    out.push({
      client,
      segment: (r[1] || "").trim(),
      type: (r[2] || "").trim(),
      status: (r[3] || "").trim(),
      revenue: parseDanishNumber(r[4]),
    });
  }
  return out;
}

export async function fetchRecurring(): Promise<RecurringRow[]> {
  const csv = await fetchTabCsv(GIDS.recurring);
  const rows = parseCsv(csv, ",");
  const data = dataRowsAfterHeader(rows);
  const out: RecurringRow[] = [];
  for (const r of data) {
    const vendor = (r[1] || "").trim();
    if (!vendor) continue;
    out.push({
      vendor,
      category: (r[2] || "").trim(),
      monthlyAmount: parseDanishNumber(r[3]),
      vat: boolFromYesNo(r[4]),
      vatAmount: parseDanishNumber(r[5]),
      totalAmount: parseDanishNumber(r[6]),
      startDate: parseEuroDate(r[7]),
      endDate: parseEuroDate(r[8]),
    });
  }
  return out;
}
