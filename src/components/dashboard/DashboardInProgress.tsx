"use client";

import { useState } from "react";
import type { Company } from "@/lib/companies";
import { LeadDrawer } from "@/components/leads/LeadDrawer";
import type { LeadState } from "@/components/leads/LeadCard";
import type { TeamListOption } from "@/components/leads/ListMenu";
import { useLeadMutations } from "@/components/leads/useLeadMutations";
import { STATUS_DEFS, statusLabel } from "@/lib/status";

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
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

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

  // Re-applied client-side (not just in the server's initial filter) so a
  // company set back to "new" with no assignee — the "not really in
  // progress" state — drops out of this list immediately, without a page
  // reload, the same way it would never have shown up here to begin with.
  const active = companies.filter((c) => {
    const lead = leadOf(c.id);
    return lead.status !== "new" || lead.assigneeId;
  });
  const counts: Record<string, number> = {};
  for (const c of active) {
    const status = leadOf(c.id).status;
    counts[status] = (counts[status] ?? 0) + 1;
  }
  const visible = statusFilter ? active.filter((c) => leadOf(c.id).status === statusFilter) : [];
  const selectedCompany = selectedId != null ? companies.find((c) => c.id === selectedId) ?? null : null;

  if (active.length === 0) {
    return <div className="dash-empty">Ingen virksomheder i gang endnu. Tildel en virksomhed eller sæt en status for at komme i gang.</div>;
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
        visible.map((c) => {
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
        })
      )}

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
