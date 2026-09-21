"use client";

import { useEffect } from "react";

// Locks background scroll while a drawer/modal is mounted. Without this, a
// touch-drag over the dimmed area behind an overlay scrolls the page
// underneath instead of doing nothing — the fixed overlay stays put but the
// content behind it shifts, so the next tap can land somewhere other than
// where it visually appears to be (including missing the close button
// entirely). Capturing/restoring the previous value (rather than always
// resetting to "") keeps nested overlays (a drawer opened on top of a
// modal) correctly locked until the outermost one closes.
export function useBodyScrollLock() {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
}
