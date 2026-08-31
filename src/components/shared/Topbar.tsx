"use client";

import { usePathname, useRouter } from "next/navigation";
import { Avatar } from "./Avatar";

const TITLES: Record<string, string> = {
  "/virksomheder": "Virksomheder",
  "/dashboard": "Dashboard",
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
      <button type="button" className="topbar-who" onClick={() => router.push("/profil")}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{name || "—"}</span>
        <Avatar name={name} avatarDataUrl={avatarDataUrl} />
      </button>
    </header>
  );
}
