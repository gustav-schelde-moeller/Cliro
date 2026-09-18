"use client";

import { useState } from "react";

export function ListActionsMenu({
  listId,
  listName,
  isPrivate,
  isMine,
  onToggleVisibility,
  onDelete,
}: {
  listId: string;
  listName: string;
  isPrivate: boolean;
  isMine: boolean;
  onToggleVisibility: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function close() {
    setOpen(false);
    setConfirmingDelete(false);
  }

  return (
    <div className="list-menu" onClick={(e) => e.stopPropagation()}>
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
          <div className="list-dropdown">
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
