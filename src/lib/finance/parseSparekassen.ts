// Verbatim port of the handed-off financial-dashboard's server/src/lib/parseSparekassen.ts.
import { parseCsv, parseDanishNumber, parseEuroDate } from "./csv";
import { categorize } from "./categorize";

export type Transaction = {
  id: string;
  source: "sparekassen";
  date: string;
  description: string;
  counterparty?: string;
  amount: number;
  category: string;
};

// Sparekassen CSV: semicolon-delimited, no header.
// [0] free text  [1] description  [2] from-account  [3] to-account  [4] amount (dk)
// [5] counterparty name  [6] blank  [7] tx date  [8] value date  [9] booking date
// [10] unique reference  [11] extra ref  [12..13] blank  [14] free text name  [15] blank
export function parseSparekassenCsv(text: string): Transaction[] {
  const rows = parseCsv(text, ";");
  const txs: Transaction[] = [];

  for (const row of rows) {
    if (row.length < 10) continue;
    const amount = parseDanishNumber(row[4]);
    if (amount === 0 && !row[4]?.trim()) continue; // not a transaction row (e.g. stray quoted note)

    const description = (row[1] || row[0] || "").trim();
    if (!description) continue;

    const counterparty = (row[5] || row[14] || "").trim() || undefined;
    const ref = (row[10] || "").trim();
    const date = parseEuroDate(row[9] || row[8] || row[7]);

    // The bank's own reference number is usually unique per row, but is
    // observed to repeat across separate recurring fee charges (same ref,
    // different date/amount) — so fold date+amount in too, keeping ref as
    // the primary signal for genuine re-import dedup.
    const id = ref ? `sparekassen:${ref}:${date}:${amount}` : `sparekassen:${date}:${description}:${amount}`;

    txs.push({
      id,
      source: "sparekassen",
      date,
      description,
      counterparty,
      amount,
      category: categorize({ description, amount, counterparty }),
    });
  }

  return txs;
}
