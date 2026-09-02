"use client";

import { useState } from "react";
import type { Company } from "@/lib/companies";
import { LeadDrawer } from "@/components/leads/LeadDrawer";
import type { LeadState } from "@/components/leads/LeadCard";
import type { TeamListOption } from "@/components/leads/ListMenu";
import { useLeadMutations } from "@/components/leads/useLeadMutations";
import { statusLabel } from "@/lib/status";

export function DashboardInProgress({
  companies,
  teamId,
  myName,
  initialLeads,
  initialStars,
  initialTeamLists,
  initialListMemberships,
}: {
  companies: Company[];
  teamId: string;
  myName: string;
  initialLeads: Record<number, LeadState>;
  initialStars: number[];
  initialTeamLists: TeamListOption[];
  initialListMemberships: Record<number, string[]>;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const {
    starred,
    teamLists,
    listMemberships,
    leadOf,
    handleToggleStar,
    handleSetStatus,
    handleAssign,
    handleRelease,
    handleToggleList,
    handleCreateList,
  } = useLeadMutations({ teamId, myName, initialLeads, initialStars, initialTeamLists, initialListMemberships });

  const selectedCompany = selectedId != null ? companies.find((c) => c.id === selectedId) ?? null : null;

  if (companies.length === 0) {
    return <div className="dash-empty">Ingen virksomheder i gang endnu. Tildel en virksomhed eller sæt en status for at komme i gang.</div>;
  }

  return (
    <>
      {companies.map((c) => {
        const lead = leadOf(c.id);
        return (
          <button type="button" className="inprogress-row inprogress-row-clickable" key={c.id} onClick={() => setSelectedId(c.id)}>
            <span className="status-pill" data-status={lead.status}>
              {statusLabel(lead.status)}
            </span>
            <b>{c.name}</b>
            <span className="tag">{c.industry}</span>
            {lead.assigneeName ? <span className="assignee-chip">👤 {lead.assigneeName}</span> : null}
          </button>
        );
      })}

      {selectedCompany ? (
        <LeadDrawer
          company={selectedCompany}
          lead={leadOf(selectedCompany.id)}
          starred={starred.has(selectedCompany.id)}
          teamLists={teamLists}
          listIds={new Set(listMemberships[selectedCompany.id] ?? [])}
          myName={myName}
          onClose={() => setSelectedId(null)}
          onToggleStar={() => handleToggleStar(selectedCompany.id)}
          onSetStatus={(status) => handleSetStatus(selectedCompany.id, status)}
          onAssign={() => handleAssign(selectedCompany.id)}
          onRelease={() => handleRelease(selectedCompany.id)}
          onToggleList={(listId) => handleToggleList(selectedCompany.id, listId)}
          onCreateList={(name) => handleCreateList(selectedCompany.id, name)}
        />
      ) : null}
    </>
  );
}
