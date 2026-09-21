"use client";

import { useState } from "react";
import { CvrDrawer } from "@/components/leads/CvrDrawer";
import type { CvrCompanyRow } from "@/components/leads/CvrBrowser";
import type { TeamListOption } from "@/components/leads/ListMenu";
import { useCvrRowMutations } from "@/components/leads/useCvrRowMutations";
import { STATUS_DEFS, statusLabel } from "@/lib/status";

export function CvrInProgress({
  companies,
  teamId,
  myName,
  initialTeamLists,
}: {
  companies: CvrCompanyRow[];
  teamId: string;
  myName: string;
  initialTeamLists: TeamListOption[];
}) {
  const [rows, setRows] = useState(companies);
  const [selected, setSelected] = useState<CvrCompanyRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const {
    teamLists,
    analyzingFor,
    handleSetStatus,
    handleAssign,
    handleRelease,
    handleToggleStar,
    handleToggleList,
    handleCreateList,
    handleAnalyze,
  } = useCvrRowMutations({ teamId, myName, initialTeamLists, setRows, setSelected });

  // Re-applied client-side so a company set back to "new" with no assignee
  // drops out immediately instead of lingering until a reload — same rule
  // DashboardInProgress applies to AI leads.
  const active = rows.filter((c) => {
    const status = c.pipeline?.status ?? "new";
    return status !== "new" || c.pipeline?.assigneeId;
  });
  const counts: Record<string, number> = {};
  for (const c of active) {
    const status = c.pipeline?.status ?? "new";
    counts[status] = (counts[status] ?? 0) + 1;
  }
  const visible = statusFilter ? active.filter((c) => (c.pipeline?.status ?? "new") === statusFilter) : [];

  if (active.length === 0) {
    return <div className="dash-empty">Ingen CVR-virksomheder i gang endnu. Sæt en status eller tildel dig selv en fra CVR-søgning.</div>;
  }

  return (
    <>
      <div className="segmented inprogress-tabs">
        {STATUS_DEFS.map((s) => (
          <button
            key={s.key}
            type="button"
            className={statusFilter === s.key ? "active" : ""}
            onClick={() => setStatusFilter((f) => (f === s.key ? null : s.key))}
          >
            {s.label} ({counts[s.key] ?? 0})
          </button>
        ))}
      </div>

      {statusFilter === null ? (
        <div className="dash-empty">Vælg en kategori ovenfor for at se virksomhederne.</div>
      ) : visible.length === 0 ? (
        <div className="dash-empty">Ingen virksomheder i denne kategori.</div>
      ) : (
        visible.map((c) => (
          <button type="button" className="inprogress-row inprogress-row-clickable" key={c.cvrNummer} onClick={() => setSelected(c)}>
            <span className="status-pill" data-status={c.pipeline?.status ?? "new"}>
              {statusLabel(c.pipeline?.status ?? "new")}
            </span>
            <b>{c.navn || `CVR ${c.cvrNummer}`}</b>
            <span className="tag">{c.brancheLabel ?? "CVR"}</span>
            {c.pipeline?.assigneeName ? <span className="assignee-chip">👤 {c.pipeline.assigneeName}</span> : null}
          </button>
        ))
      )}

      {selected ? (
        <CvrDrawer
          company={selected}
          myName={myName}
          teamLists={teamLists}
          analyzing={analyzingFor === selected.cvrNummer}
          onClose={() => setSelected(null)}
          onToggleStar={() => handleToggleStar(selected)}
          onSetStatus={(status) => handleSetStatus(selected, status)}
          onAssign={() => handleAssign(selected)}
          onRelease={() => handleRelease(selected)}
          onToggleList={(listId) => handleToggleList(selected, listId)}
          onCreateList={(name) => handleCreateList(selected, name)}
          onAnalyze={() => handleAnalyze(selected)}
        />
      ) : null}
    </>
  );
}
