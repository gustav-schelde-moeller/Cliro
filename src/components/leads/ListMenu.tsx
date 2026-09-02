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
        <svg viewBox="0 0 24 24" width={22} height={22} fill={listIds.size ? "currentColor" : "none"}>
          <path
            d="M3 6.8C3 5.8 3.8 5 4.8 5h4.3l2 2h8.1c1 0 1.8.8 1.8 1.8v8.4c0 1-.8 1.8-1.8 1.8H4.8C3.8 19 3 18.2 3 17.2V6.8Z"
            stroke={listIds.size ? "none" : "currentColor"}
            strokeWidth="1.8"
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
