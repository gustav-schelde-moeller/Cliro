// Verbatim port of the handed-off financial-dashboard's server/src/routes/summary.ts
// calculation logic (moved from a route handler into a plain function, storage
// swapped from JSON files to Prisma via ./store — the math and its comments
// are unchanged).
import { loadCashPosition, loadLastSheetSync, loadPipeline, loadRecurring, loadSalaries, loadTransactions } from "./store";
import { exclVat, REVENUE, TAX, VAT_RATE } from "./categorize";

// All date math here is done in UTC on purpose: mixing local-time
// constructors (setMonth/setDate) with toISOString() (always UTC) rolls the
// displayed month back by a day in any timezone ahead of UTC (e.g. Denmark's
// summer CEST, UTC+2) — midnight local becomes 22:00 the previous day in UTC.
function addMonthsUTC(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const wholeMonths = Math.floor(months);
  const fractionalDays = (months - wholeMonths) * 30.44; // avg days/month
  d.setUTCMonth(d.getUTCMonth() + wholeMonths);
  d.setUTCDate(d.getUTCDate() + Math.round(fractionalDays));
  return d;
}

// Davai settles VAT semi-annually (H1/H2), not quarterly.
function halfKey(isoDate: string): string {
  const year = isoDate.slice(0, 4);
  const month = Number(isoDate.slice(5, 7));
  return `${year}-H${month <= 6 ? 1 : 2}`;
}

export async function getSummary() {
  const txs = await loadTransactions();
  const pipeline = await loadPipeline();
  const recurring = await loadRecurring();
  const lastSheetSync = await loadLastSheetSync();
  const cashPosition = await loadCashPosition();
  const salaries = await loadSalaries();

  // Sparekassen is the sole source for EXPENSES. Pleo's CARD_PURCHASE rows
  // are just a receipt for what an OVERFØRSEL (already counted as a
  // Sparekassen expense, categorized as "Pleo (card spend)") was later spent
  // on — adding them in here would double-count the same money leaving the
  // business. "Tax" (SKAT remittances) isn't an operating expense — it's the
  // *output* of VAT/tax settlement, not an input to it — so it's excluded.
  //
  // Bank cash amounts are VAT-inclusive with no per-row VAT flag, so expenses
  // back out the Danish 25% rate per category (exclVat). The Google Sheet
  // (Pipeline/Recurring), by contrast, already tracks revenue excl. VAT
  // natively via its own REVENUE column — that must NOT be VAT-adjusted again.
  const ledgerTxs = txs.filter((tx) => tx.source === "sparekassen" && tx.category !== TAX);

  let expenses = 0;
  const expensesByMonth: Record<string, number> = {};
  const categoryTotals: Record<string, number> = {};
  const vatPaidByHalf: Record<string, number> = {};

  for (const tx of ledgerTxs) {
    if (tx.amount >= 0) continue; // only bank deductions are "expenses" here
    const month = tx.date.slice(0, 7);
    const half = halfKey(tx.date);
    const exp = exclVat(-tx.amount, tx.category);

    expenses += exp;
    expensesByMonth[month] = (expensesByMonth[month] || 0) + exp;
    categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + exp;
    vatPaidByHalf[half] = (vatPaidByHalf[half] || 0) + (-tx.amount - exp);
  }

  // Revenue YTD = Pipeline rows marked "Paid" only. Open pipeline = anything
  // not yet paid (Planned / Invoiced / Send invoice, and any other/future
  // status too, so nothing silently drops off). Both read the sheet's own
  // excl-VAT REVENUE column directly; no VAT math applied here — the sheet
  // already tracks revenue excl. VAT natively.
  const paidPipeline = pipeline.filter((p) => p.status === "Paid");
  const openPipeline = pipeline.filter((p) => p.status !== "Paid").sort((a, b) => a.date.localeCompare(b.date));

  const revenue = paidPipeline.reduce((sum, p) => sum + p.revenue, 0);
  const openPipelineValue = openPipeline.reduce((sum, p) => sum + p.revenue, 0);
  const rollingForecast = revenue + openPipelineValue;

  const revenueByMonth: Record<string, number> = {};
  const vatCollectedByHalf: Record<string, number> = {};
  for (const p of paidPipeline) {
    const month = p.date.slice(0, 7);
    const half = halfKey(p.date);
    revenueByMonth[month] = (revenueByMonth[month] || 0) + p.revenue;
    vatCollectedByHalf[half] = (vatCollectedByHalf[half] || 0) + p.vatAmount;
  }

  const months = new Set([...Object.keys(revenueByMonth), ...Object.keys(expensesByMonth)]);
  const monthlySeries = [...months]
    .sort()
    .map((month) => ({
      month,
      revenue: revenueByMonth[month] || 0,
      expenses: expensesByMonth[month] || 0,
    }));

  const categoryBreakdown = Object.entries(categoryTotals)
    .filter(([cat]) => cat !== REVENUE)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([category, total]) => ({ category, total }));

  // Only "owed" (collected minus paid) is exposed — the collected/paid split
  // individually relies on the category-based VAT-exclusion heuristic and
  // isn't precise enough to show on its own, even though the net owed figure
  // has checked out against the real H1 VAT bill.
  const halves = new Set([...Object.keys(vatCollectedByHalf), ...Object.keys(vatPaidByHalf)]);
  const vatByHalf = [...halves]
    .sort()
    .map((half) => ({
      half,
      vatOwed: (vatCollectedByHalf[half] || 0) - (vatPaidByHalf[half] || 0),
    }));

  const recentTransactions = [...ledgerTxs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  const recurringMonthlyTotal = recurring.reduce((sum, r) => sum + r.monthlyAmount, 0);
  const salariesMonthlyTotal = salaries.reduce((sum, s) => sum + s.monthlyAmount, 0);
  const monthlyBurn = recurringMonthlyTotal + salariesMonthlyTotal;

  const recurringCategoryTotals: Record<string, { monthlyAmount: number; count: number }> = {};
  for (const r of recurring) {
    if (!recurringCategoryTotals[r.category]) recurringCategoryTotals[r.category] = { monthlyAmount: 0, count: 0 };
    recurringCategoryTotals[r.category].monthlyAmount += r.monthlyAmount;
    recurringCategoryTotals[r.category].count += 1;
  }
  const recurringByCategory = Object.entries(recurringCategoryTotals)
    .sort(([, a], [, b]) => b.monthlyAmount - a.monthlyAmount)
    .map(([category, v]) => ({ category, monthlyAmount: v.monthlyAmount, count: v.count }));

  // Runway counts the open pipeline as money still coming in, on top of
  // cash already in the bank — not yet paid, but expected.
  let runwayMonths: number | null = null;
  let runwayDate: string | null = null;
  let runwayFundsAvailable: number | null = null;
  if (cashPosition.balance !== null && monthlyBurn > 0) {
    runwayFundsAvailable = cashPosition.balance + openPipelineValue;
    runwayMonths = runwayFundsAvailable / monthlyBurn;
    runwayDate = addMonthsUTC(new Date(), runwayMonths).toISOString().slice(0, 10);
  }

  return {
    cashPosition,
    salaries,
    recurringMonthlyTotal,
    salariesMonthlyTotal,
    monthlyBurn,
    runwayFundsAvailable,
    runwayMonths,
    runwayDate,
    revenue,
    openPipelineValue,
    rollingForecast,
    expenses,
    net: revenue - expenses,
    vatRate: VAT_RATE,
    vatByHalf,
    monthlySeries,
    categoryBreakdown,
    recurring,
    recurringByCategory,
    openPipeline,
    recentTransactions,
    lastSheetSync,
    transactionCount: txs.length,
  };
}
