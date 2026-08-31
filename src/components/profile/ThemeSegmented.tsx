"use client";

import { useState } from "react";

type Theme = "light" | "dark" | "system";
const KEY = "cliro_theme_v1";

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
  } catch {
    // ignore
  }
  return "system";
}

export function ThemeSegmented() {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  function apply(t: Theme) {
    setTheme(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      // ignore
    }
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }

  return (
    <div className="segmented">
      <button className={theme === "light" ? "active" : ""} onClick={() => apply("light")}>
        Lyst
      </button>
      <button className={theme === "dark" ? "active" : ""} onClick={() => apply("dark")}>
        Mørkt
      </button>
      <button className={theme === "system" ? "active" : ""} onClick={() => apply("system")}>
        System
      </button>
    </div>
  );
}
