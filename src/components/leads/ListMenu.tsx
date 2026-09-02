"use client";

import { useEffect, useRef, useState } from "react";

export type TeamListOption = { id: string; name: string };

const CLOSE_DELAY_MS = 350;

export function ListMenu({
  companyName,
  teamLists,
  listIds,
  onToggleList,
  onCreateList,
  className,
}: {
  companyName: string;
  teamLists: TeamListOption[];
  listIds: Set<string>;
  onToggleList: (listId: string) => void;
  onCreateList: (name: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
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
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      setNewListName("");
    }, CLOSE_DELAY_MS);
  }

  function closeNow() {
    cancelScheduledClose();
    setOpen(false);
    setNewListName("");
  }

  function submitNewList() {
    const trimmed = newListName.trim();
    if (!trimmed) return;
    onCreateList(trimmed);
    closeNow();
  }

  return (
    <div
      className={`list-menu${className ? ` ${className}` : ""}`}
      onMouseEnter={cancelScheduledClose}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className={`star-btn list-btn${listIds.size ? " has-lists" : ""}`}
        aria-label={`Tilføj ${companyName} til en liste`}
        title="Tilføj til liste"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" width={17} height={17}>
          <path
            d="M3.5 7.2a1.5 1.5 0 0 1 1.5-1.5h4.1l1.8 1.8H19a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5V7.2Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? (
        <div className="list-dropdown" onClick={(e) => e.stopPropagation()}>
          {teamLists.length === 0 ? (
            <div className="list-dropdown-empty">Ingen lister endnu</div>
          ) : (
            teamLists.map((l) => (
              <label className="list-opt" key={l.id}>
                <input type="checkbox" checked={listIds.has(l.id)} onChange={() => onToggleList(l.id)} />
                {l.name}
              </label>
            ))
          )}
          <div className="list-dropdown-divider" />
          <div className="list-create-row">
            <input
              type="text"
              className="field"
              placeholder="+ Ny liste"
              value={newListName}
              maxLength={60}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNewList();
              }}
            />
            <button type="button" className="btn" disabled={!newListName.trim()} onClick={submitNewList}>
              Opret
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
