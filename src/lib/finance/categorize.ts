// Verbatim port of the handed-off financial-dashboard's server/src/lib/categorize.ts.
import rules from "./categoryRules.json";

export const REFUNDS = "Refunds";
export const REVENUE = "Revenue";
export const UNCATEGORIZED = "Uncategorized";
export const TAX = "Tax";
export const PAYROLL = "Payroll & Benefits";
// OVERFØRSEL rows fund the team's Pleo card; Pleo's own statement is just a
// receipt for what that money was later spent on and isn't tracked here, so
// the OVERFØRSEL itself is the real, categorized Sparekassen expense.
export const PLEO_CARD_SPEND = "Pleo (card spend)";

// Danish standard VAT rate (moms). Bank cash amounts are VAT-inclusive; the
// dashboard reports everything excl. VAT, so this backs it out per category.
export const VAT_RATE = 0.25;
// Categories where the cash amount never carried VAT to begin with, so no
// VAT adjustment applies: wages aren't VATable, and a Pleo top-up is an
// internal transfer, not a purchase (its VAT content isn't tracked here
// now that Pleo's own statement is no longer imported).
export const VAT_EXEMPT_CATEGORIES = new Set([PAYROLL, PLEO_CARD_SPEND]);

export function exclVat(amount: number, category: string): number {
  return VAT_EXEMPT_CATEGORIES.has(category) ? amount : amount / (1 + VAT_RATE);
}

export interface CategorizeInput {
  description: string;
  amount: number;
  counterparty?: string;
}

export function categorize({ description, amount, counterparty }: CategorizeInput): string {
  // Match against description + counterparty together: Sparekassen often puts
  // the invoice reference in the description and the actual payee name (e.g.
  // "Mateusz Jakub Karys") in a separate counterparty field.
  const upper = `${description} ${counterparty || ""}`.toUpperCase();

  if (upper.includes("OVERFØRSEL") || upper.includes("OVERFOERSEL")) return PLEO_CARD_SPEND;
  if (upper.includes("DAVAI RETURN") || upper.includes("DAVAI RETUR") || upper.includes("EXPENSE RETURN")) {
    return REFUNDS;
  }

  for (const rule of rules as { category: string; keywords: string[] }[]) {
    if (rule.keywords.some((kw) => upper.includes(kw.toUpperCase()))) {
      return rule.category;
    }
  }

  return amount > 0 ? REVENUE : UNCATEGORIZED;
}
