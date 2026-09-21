"use client";

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  maxWidth,
}: {
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  // Widens the panel past its 360px default (e.g. for a modal that holds a
  // wide table) while keeping the same centered scrim/panel scaffolding.
  maxWidth?: number;
}) {
  return (
    <>
      <div className="scrim open" onClick={onClose} />
      <div className="modal-panel" style={maxWidth ? { width: `min(${maxWidth}px, calc(100vw - 32px))` } : undefined}>
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
      </div>
    </>
  );
}
