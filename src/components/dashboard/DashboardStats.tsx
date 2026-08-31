"use client";

import { useEffect, useState } from "react";

function AnimatedNumber({ target }: { target: number }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const dur = 550;
    let raf = 0;
    let startTime: number | null = null;
    function step(ts: number) {
      if (startTime === null) startTime = ts;
      const p = Math.min(1, (ts - startTime) / dur);
      setValue(Math.round(target * p));
      if (p < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return <b>{value}</b>;
}

export function DashboardStats({
  total,
  hot,
  named,
  starred,
  won,
}: {
  total: number;
  hot: number;
  named: number;
  starred: number;
  won: number;
}) {
  return (
    <div className="stat-grid">
      <div className="stat-card">
        <AnimatedNumber target={total} />
        <span>Klienter i alt</span>
      </div>
      <div className="stat-card">
        <AnimatedNumber target={hot} />
        <span>Varme leads</span>
      </div>
      <div className="stat-card">
        <AnimatedNumber target={named} />
        <span>Navngivet kontakt</span>
      </div>
      <div className="stat-card">
        <AnimatedNumber target={starred} />
        <span>Stjernemarkeret</span>
      </div>
      <div className="stat-card">
        <AnimatedNumber target={won} />
        <span>Vundet</span>
      </div>
    </div>
  );
}
