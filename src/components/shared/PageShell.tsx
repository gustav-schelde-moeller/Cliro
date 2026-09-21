"use client";

import { usePathname } from "next/navigation";

// Pages built around a wide data table (many nowrap columns) need the full
// available width instead of the shared 1180px reading-width cap — capping
// them wastes space on wide screens while simultaneously forcing the table
// into horizontal scroll it doesn't need. Simpler pages (Profil, Team, ...)
// keep the narrower cap since it's the right reading width for prose/forms.
const WIDE_PATHS = new Set(["/virksomheder", "/lister"]);

export function PageShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const wide = WIDE_PATHS.has(pathname);
  return <div className={`page enter${wide ? " page-wide" : ""}`}>{children}</div>;
}
