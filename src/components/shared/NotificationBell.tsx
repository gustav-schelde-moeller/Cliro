"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { daysUntil, followUpRelative, formatFollowUpDate } from "@/lib/followup";
import type { NotificationsPayload } from "@/lib/notification-types";
import { NOTIFICATIONS_REFRESH_EVENT } from "./notificationEvents";

const POLL_MS = 60_000;
const PANEL_MAX_WIDTH = 360;

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "nu";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}t`;
  return `${Math.floor(hours / 24)}d`;
}

export function NotificationBell() {
  const router = useRouter();
  const [data, setData] = useState<NotificationsPayload | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return null;
      const payload: NotificationsPayload = await res.json();
      setData(payload);
      return payload;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const refresh = () => {
      void load();
    };
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    window.addEventListener("focus", refresh);
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, refresh);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.min(PANEL_MAX_WIDTH, window.innerWidth - 24);
      const right = Math.max(12, Math.min(window.innerWidth - rect.right, window.innerWidth - width - 12));
      setPos({ top: rect.bottom + 8, right, width });
    }
    setOpen(true);
    // Fresh copy first so the unread rows are highlighted for this viewing,
    // then mark them read so the badge clears.
    const fresh = await load();
    if (fresh && fresh.unread > 0) {
      await fetch("/api/notifications", { method: "POST" });
      setData({ ...fresh, unread: 0 });
    }
  }

  function go(href: string | null) {
    setOpen(false);
    if (href) router.push(href);
  }

  const dueCount = data?.followUps.filter((f) => daysUntil(f.date) <= 0).length ?? 0;
  const badge = (data?.unread ?? 0) + dueCount;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`bell-btn${open ? " open" : ""}`}
        aria-label={badge > 0 ? `Notifikationer (${badge} nye)` : "Notifikationer"}
        title="Notifikationer"
        onClick={toggle}
      >
        <svg viewBox="0 0 24 24" fill="none" width={18} height={18}>
          <path
            d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M10 20.5a2.2 2.2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {badge > 0 ? <span className="bell-badge">{badge > 9 ? "9+" : badge}</span> : null}
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={panelRef}
              className="notif-panel"
              style={{ position: "fixed", top: pos.top, right: pos.right, width: pos.width }}
              role="dialog"
              aria-label="Notifikationer"
            >
              <div className="notif-head">Notifikationer</div>
              <div className="notif-scroll">
                {data && data.followUps.length > 0 ? (
                  <>
                    <div className="notif-section">Dine opfølgninger</div>
                    {data.followUps.map((f) => {
                      const rel = followUpRelative(f.date);
                      return (
                        <button key={f.key} type="button" className="notif-row" onClick={() => go(f.href)}>
                          <span className={`notif-dot followup-${rel.state}`} />
                          <span className="notif-main">
                            <b>{f.name}</b>
                            <span className="notif-sub">{formatFollowUpDate(f.date)}</span>
                          </span>
                          <span className={`followup-chip ${rel.state}`}>{rel.label}</span>
                        </button>
                      );
                    })}
                  </>
                ) : null}

                <div className="notif-section">Fra teamet</div>
                {!data ? (
                  <div className="notif-empty">Henter…</div>
                ) : data.items.length === 0 ? (
                  <div className="notif-empty">Ingen notifikationer endnu.</div>
                ) : (
                  data.items.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      className={`notif-row${n.unread ? " unread" : ""}`}
                      onClick={() => go(n.href)}
                    >
                      <span className={`notif-dot${n.unread ? " unread" : ""}`} />
                      <span className="notif-main">
                        <span>
                          <b>{n.actorName}</b> {n.text}
                          {n.companyName ? (
                            <>
                              {" "}
                              <b>{n.companyName}</b>
                            </>
                          ) : null}
                        </span>
                      </span>
                      <span className="notif-time">{timeAgo(n.createdAt)}</span>
                    </button>
                  ))
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
