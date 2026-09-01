"use client";

import { useEffect, useState } from "react";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

// An already-open tab keeps running the JS it loaded at page-load time even
// after a new version is deployed. This polls for the deployed commit and
// prompts a reload once it changes, instead of leaving people on stale code
// until they happen to hit refresh themselves.
export function UpdateChecker({ currentCommit }: { currentCommit: string | null }) {
  const [newVersionAvailable, setNewVersionAvailable] = useState(false);

  useEffect(() => {
    if (!currentCommit) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const data = await res.json();
        if (data.commit && data.commit !== currentCommit) {
          setNewVersionAvailable(true);
        }
      } catch {
        // Transient network error — try again next interval.
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [currentCommit]);

  if (!newVersionAvailable) return null;

  return (
    <div className="update-banner">
      <span>Der er en ny version af Cliro klar.</span>
      <button type="button" className="btn primary" onClick={() => window.location.reload()}>
        Opdater
      </button>
    </div>
  );
}
