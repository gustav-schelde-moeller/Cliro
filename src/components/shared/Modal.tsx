"use client";

import { useBodyScrollLock } from "./useBodyScrollLock";

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  maxWidth,
  dimmed,
}: {
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  // Widens the panel past its 360px default (e.g. for a modal that holds a
  // wide table) while keeping the same centered scrim/panel scaffolding.
  maxWidth?: number;
  // Fades the panel back when something else (another drawer) has opened
  // on top of it, so it reads as "in the background" rather than looking
  // like a second, independently-lit layer stacked underneath.
  dimmed?: boolean;
}) {
  useBodyScrollLock();
  return (
    <>
      <div className="scrim open" onClick={onClose} />
      <div
        className="modal-panel"
        style={maxWidth ? { width: `min(${maxWidth}px, calc(100vw - 32px))` } : undefined}
      >
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle ? <div className="distance-note">{subtitle}</div> : null}
          </div>
          <button type="button" className="drawer-close" aria-label="Luk" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" width={16} height={16}>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {/* An opaque tint painted over the panel's own (still fully opaque)
            content, rather than reducing the panel's own opacity — that
            made the page behind it bleed through into the panel, reading
            as a ghosting double-exposure instead of a simple dim. */}
        {dimmed ? <div className="modal-dim-overlay" /> : null}
      </div>
    </>
  );
}
