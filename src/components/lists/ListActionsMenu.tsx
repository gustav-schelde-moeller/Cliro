"use client";

import { useEffect, useRef, useState } from "react";

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
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  return (
    <div className="list-menu" onClick={(e) => e.stopPropagation()} onMouseEnter={cancelScheduledClose} onMouseLeave={scheduleClose}>
      <button
        type="button"
        className="drawer-close"
        aria-label={`Handlinger for ${listName}`}
        title="Handlinger"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="kebab-dots">⋯</span>
      </button>
      {open ? (
        <>
          <div className="team-switcher-backdrop" onClick={close} />
          <div className="list-dropdown" onMouseEnter={cancelScheduledClose} onMouseLeave={scheduleClose}>
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
          </div>
        </>
      ) : null}
    </div>
  );
}
