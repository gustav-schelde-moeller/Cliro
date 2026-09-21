"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

  // Positioned via a portal to document.body rather than CSS position:absolute
  // relative to this component — this component is often rendered inside a
  // horizontally-scrolling table cell (CvrBrowser), whose overflow:auto
  // clips/misplaces any absolutely-positioned descendant. Fixed positioning
  // computed from the trigger's real screen position escapes that entirely.
  function toggleOpen() {
    if (open) {
      closeNow();
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    setOpen(true);
  }

  return (
    <div className={`list-menu${className ? ` ${className}` : ""}`} onMouseEnter={cancelScheduledClose} onMouseLeave={scheduleClose}>
      <button
        ref={triggerRef}
        type="button"
        className={`star-btn list-btn${listIds.size ? " has-lists" : ""}`}
        aria-label={`Tilføj ${companyName} til en liste`}
        title="Tilføj til liste"
        onClick={(e) => {
          e.stopPropagation();
          toggleOpen();
        }}
      >
        <svg viewBox="0 0 24 24" width={24} height={24} fill={listIds.size ? "currentColor" : "none"}>
          <path
            d="M1.5 5.5C1.5 4.4 2.4 3.5 3.5 3.5H9.3l2.3 2.3H20.5C21.6 5.8 22.5 6.7 22.5 7.8V18.5C22.5 19.6 21.6 20.5 20.5 20.5H3.5C2.4 20.5 1.5 19.6 1.5 18.5V5.5Z"
            stroke={listIds.size ? "none" : "currentColor"}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
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
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
