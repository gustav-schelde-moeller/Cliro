"use client";

import { useState } from "react";
import { CvrDrawer } from "@/components/leads/CvrDrawer";
import type { CvrCompanyRow } from "@/components/leads/CvrBrowser";
import type { TeamListOption } from "@/components/leads/ListMenu";
import { useCvrRowMutations } from "@/components/leads/useCvrRowMutations";
import { statusLabel } from "@/lib/status";

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

  const { teamLists, handleSetStatus, handleAssign, handleRelease, handleToggleStar, handleToggleList, handleCreateList } =
    useCvrRowMutations({ teamId, myName, initialTeamLists, setRows, setSelected });

  if (rows.length === 0) {
    return <div className="dash-empty">Ingen CVR-virksomheder i gang endnu. Sæt en status eller tildel dig selv en fra CVR-søgning.</div>;
  }

  return (
    <>
      {rows.map((c) => (
        <button type="button" className="inprogress-row inprogress-row-clickable" key={c.cvrNummer} onClick={() => setSelected(c)}>
          <span className="status-pill" data-status={c.pipeline?.status ?? "new"}>
            {statusLabel(c.pipeline?.status ?? "new")}
          </span>
          <b>{c.navn || `CVR ${c.cvrNummer}`}</b>
          <span className="tag">{c.brancheLabel ?? "CVR"}</span>
          {c.pipeline?.assigneeName ? <span className="assignee-chip">👤 {c.pipeline.assigneeName}</span> : null}
        </button>
      ))}

      {selected ? (
        <CvrDrawer
          company={selected}
          myName={myName}
          teamLists={teamLists}
          onClose={() => setSelected(null)}
          onToggleStar={() => handleToggleStar(selected)}
          onSetStatus={(status) => handleSetStatus(selected, status)}
          onAssign={() => handleAssign(selected)}
          onRelease={() => handleRelease(selected)}
          onToggleList={(listId) => handleToggleList(selected, listId)}
          onCreateList={(name) => handleCreateList(selected, name)}
        />
      ) : null}
    </>
  );
}
