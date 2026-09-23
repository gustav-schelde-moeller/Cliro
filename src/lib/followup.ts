// Follow-up dates are calendar days, not instants: stored as UTC midnight and
// always handled as plain "YYYY-MM-DD" strings, with "today" taken in Danish
// time — so a date never shifts by a day across time zones or DST changes.
const TZ = "Europe/Copenhagen";

export const FOLLOW_UP_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(now);
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysUntil(iso: string, now: Date = new Date()): number {
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${todayIso(now)}T00:00:00Z`)) / 86_400_000);
}

export function formatFollowUpDate(iso: string): string {
  return new Intl.DateTimeFormat("da-DK", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

export type FollowUpState = "overdue" | "today" | "soon" | "later";

export function followUpRelative(iso: string, now?: Date): { label: string; state: FollowUpState } {
  const n = daysUntil(iso, now);
  if (n < 0) return { label: n === -1 ? "1 dag over" : `${-n} dage over`, state: "overdue" };
  if (n === 0) return { label: "I dag", state: "today" };
  if (n === 1) return { label: "I morgen", state: "soon" };
  return { label: `Om ${n} dage`, state: n <= 7 ? "soon" : "later" };
}

export function toFollowUpIso(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}
