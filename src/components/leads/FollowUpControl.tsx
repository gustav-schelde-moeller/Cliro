"use client";

import { useState } from "react";
import { addDaysIso, followUpRelative, formatFollowUpDate, todayIso } from "@/lib/followup";

const QUICK_PICKS = [
  { label: "I morgen", days: 1 },
  { label: "Om 3 dage", days: 3 },
  { label: "Om 1 uge", days: 7 },
  { label: "Om 2 uger", days: 14 },
];

export function FollowUpControl({ value, onChange }: { value: string | null; onChange: (date: string | null) => void }) {
  const [editing, setEditing] = useState(false);

  function pick(date: string) {
    onChange(date);
    setEditing(false);
  }

  if (value && !editing) {
    const rel = followUpRelative(value);
    return (
      <div className="followup">
        <span className={`followup-chip ${rel.state}`}>
          Følg op {formatFollowUpDate(value)} · {rel.label}
        </span>
        <button type="button" className="role-btn" onClick={() => setEditing(true)}>
          Ændr
        </button>
        <button type="button" className="role-btn" onClick={() => onChange(null)}>
          Fjern
        </button>
      </div>
    );
  }

  return (
    <div className="followup">
      {QUICK_PICKS.map((q) => (
        <button key={q.days} type="button" className="chip" onClick={() => pick(addDaysIso(todayIso(), q.days))}>
          {q.label}
        </button>
      ))}
      <input
        type="date"
        className="field followup-date"
        aria-label="Vælg opfølgningsdato"
        min={todayIso()}
        value={value ?? ""}
        onChange={(e) => {
          if (e.target.value) pick(e.target.value);
        }}
      />
      {editing ? (
        <button type="button" className="role-btn" onClick={() => setEditing(false)}>
          Annullér
        </button>
      ) : null}
    </div>
  );
}
