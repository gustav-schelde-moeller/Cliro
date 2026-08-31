"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "./Logo";
import { useToast, errorMessage } from "./ToastProvider";
import { switchTeamAction, joinTeamAction, type ActionResult } from "@/lib/actions/team-actions";

const NAV_ITEMS = [
  {
    href: "/virksomheder",
    label: "Virksomheder",
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    ),
  },
  {
    href: "/team",
    label: "Team",
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="17" cy="8.5" r="2.3" stroke="currentColor" strokeWidth="1.6" />
        <path d="M15.3 13.2c2.4.2 4.2 2 4.2 4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/profil",
    label: "Profil",
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="1.7" />
        <path d="M4.5 20c0-4 3.4-6.8 7.5-6.8s7.5 2.8 7.5 6.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
];

const initialJoinState: ActionResult = {};

function TeamSwitcher({
  teamName,
  teamId,
  userTeams,
}: {
  teamName: string;
  teamId: string;
  userTeams: { id: string; name: string }[];
}) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [switching, startSwitching] = useTransition();
  const [joining, startJoining] = useTransition();

  function close() {
    setOpen(false);
    setJoinOpen(false);
    setJoinCode("");
  }

  function handleSwitch(id: string) {
    if (id === teamId) return close();
    startSwitching(async () => {
      try {
        await switchTeamAction(id);
      } catch (err) {
        showToast(errorMessage(err, "Kunne ikke skifte team."));
      }
    });
  }

  function handleJoin() {
    if (!joinCode.trim()) return;
    startJoining(async () => {
      const fd = new FormData();
      fd.append("code", joinCode);
      try {
        const result = await joinTeamAction(initialJoinState, fd);
        if (result?.error) showToast(result.error);
      } catch (err) {
        showToast(errorMessage(err, "Kunne ikke joine teamet."));
      }
    });
  }

  return (
    <div className="team-switcher">
      <button type="button" className="team-switcher-trigger" onClick={() => setOpen((v) => !v)} aria-label="Skift eller join team">
        <div style={{ minWidth: 0 }}>
          <b>CLIRO</b>
          <div className="sidebar-team-name">{teamName}</div>
        </div>
        <span className="kebab-dots">⋯</span>
      </button>
      {open ? (
        <>
          <div className="team-switcher-backdrop" onClick={close} />
          <div className="team-switcher-dropdown">
            {userTeams.map((t) => (
              <button
                key={t.id}
                type="button"
                className="status-opt"
                disabled={switching}
                onClick={() => handleSwitch(t.id)}
              >
                <span className={`team-dot${t.id === teamId ? " active" : ""}`} />
                {t.name}
              </button>
            ))}
            <div className="team-switcher-divider" />
            {joinOpen ? (
              <div className="team-switcher-join">
                <input
                  type="text"
                  className="field"
                  placeholder="Invitationskode"
                  maxLength={12}
                  style={{ textTransform: "uppercase" }}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  autoFocus
                />
                <button type="button" className="btn primary" disabled={joining} onClick={handleJoin}>
                  {joining ? "…" : "Join"}
                </button>
              </div>
            ) : (
              <button type="button" className="status-opt" onClick={() => setJoinOpen(true)}>
                + Join et team
              </button>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function Sidebar({
  teamName,
  teamId,
  userTeams,
  companyCount,
}: {
  teamName: string;
  teamId: string;
  userTeams: { id: string; name: string }[];
  companyCount: number;
}) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">
          <LogoMark size={30} />
        </div>
        <TeamSwitcher teamName={teamName} teamId={teamId} userTeams={userTeams} />
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} className={`nav-item${pathname === item.href ? " active" : ""}`}>
            {item.icon}
            <span>{item.label}</span>
            {item.href === "/virksomheder" ? (
              <span className="nav-badge">{companyCount}</span>
            ) : null}
          </Link>
        ))}
      </nav>
      <Link href="/indstillinger" className={`nav-item settings-link${pathname === "/indstillinger" ? " active" : ""}`}>
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3.3" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M12 3.5v2.4M12 18.1v2.4M20.5 12h-2.4M5.9 12H3.5M17.8 6.2l-1.7 1.7M7.9 16.1l-1.7 1.7M17.8 17.8l-1.7-1.7M7.9 7.9 6.2 6.2"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
        <span>Indstillinger</span>
      </Link>
    </aside>
  );
}
