"use client";

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="scrim open" onClick={onClose} />
      <div className="modal-panel">
        <div className="modal-head">
          <h3>{title}</h3>
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
