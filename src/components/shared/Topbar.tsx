"use client";

import { usePathname, useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import { NotificationBell } from "./NotificationBell";

const TITLES: Record<string, string> = {
  "/virksomheder": "Virksomheder",
  "/pipeline": "Pipeline",
  "/dashboard": "Dashboard",
  "/lister": "Lister",
  "/team": "Team",
  "/profil": "Profil",
};

export function Topbar({ name, avatarDataUrl }: { name: string; avatarDataUrl: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const title = TITLES[pathname] ?? "";

  return (
    <header className="topbar">
      <h1>{title}</h1>
      <div className="topbar-right">
        <NotificationBell />
        <button type="button" className="topbar-who" onClick={() => router.push("/profil")}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{name || "—"}</span>
          <Avatar name={name} avatarDataUrl={avatarDataUrl} />
        </button>
      </div>
    </header>
  );
}
