"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const CLOSE_DELAY_MS = 350;

export function ListActionsMenu({
  listId,
  listName,
  isPrivate,
  isMine,
  teamCanEdit,
  onToggleVisibility,
  onToggleTeamEdit,
  onDelete,
}: {
  listId: string;
  listName: string;
  isPrivate: boolean;
  isMine: boolean;
  teamCanEdit: boolean;
  onToggleVisibility: () => void;
  onToggleTeamEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  function cancelScheduledClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function scheduleClose() {
    cancelScheduledClose();
    closeTimer.current = setTimeout(close, CLOSE_DELAY_MS);
  }

  function close() {
    cancelScheduledClose();
    setOpen(false);
    setConfirmingDelete(false);
  }

  // Positioned via a portal to document.body rather than CSS position:
  // absolute relative to this component — a list card can sit anywhere in
  // a long, scrolling column of other list cards, whose own backgrounds
  // and stacking order would otherwise clip or bury this dropdown instead
  // of it always rendering on top. Same pattern as ListMenu's dropdown.
  function toggleOpen() {
    if (open) {
      close();
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    setOpen(true);
  }

  return (
    <div className="list-menu" onClick={(e) => e.stopPropagation()} onMouseEnter={cancelScheduledClose} onMouseLeave={scheduleClose}>
      <button
        ref={triggerRef}
        type="button"
        className="drawer-close"
        aria-label={`Handlinger for ${listName}`}
        title="Handlinger"
        onClick={toggleOpen}
      >
        <span className="kebab-dots">⋯</span>
      </button>
      {open && pos
        ? createPortal(
            <div
              className="list-dropdown"
              style={{ position: "fixed", top: pos.top, right: pos.right }}
              onClick={(e) => e.stopPropagation()}
              onMouseEnter={cancelScheduledClose}
              onMouseLeave={scheduleClose}
            >
              {isMine ? (
                <button
                  type="button"
                  className="list-opt"
                  onClick={() => {
                    onToggleVisibility();
                    close();
                  }}
                >
                  {isPrivate ? "Gør synlig for team" : "Gør privat"}
                </button>
              ) : null}
              {isMine && !isPrivate ? (
                <button
                  type="button"
                  className="list-opt"
                  onClick={() => {
                    onToggleTeamEdit();
                    close();
                  }}
                >
                  {teamCanEdit ? "Kun du kan redigere" : "Lad teamet redigere"}
                </button>
              ) : null}
              <a className="list-opt" href={`/api/lists/${listId}/export`} onClick={close}>
                Eksportér
              </a>
              {isMine ? (
                <>
                  <div className="list-dropdown-divider" />
                  {confirmingDelete ? (
                    <div className="delete-confirm-row" style={{ padding: "2px" }}>
                      <button type="button" className="btn" onClick={close}>
                        Fortryd
                      </button>
                      <button
                        type="button"
                        className="btn danger"
                        onClick={() => {
                          onDelete();
                          close();
                        }}
                      >
                        Ja, slet
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="list-opt" style={{ color: "var(--bad)" }} onClick={() => setConfirmingDelete(true)}>
                      Slet
                    </button>
                  )}
                </>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
