"use client";

import { useState } from "react";
import type { Company } from "@/lib/companies";
import { LeadDrawer } from "@/components/leads/LeadDrawer";
import { CvrDrawer } from "@/components/leads/CvrDrawer";
import type { LeadState } from "@/components/leads/LeadCard";
import type { CvrCompanyRow } from "@/components/leads/CvrBrowser";
import type { TeamListOption } from "@/components/leads/ListMenu";
import { useLeadMutations } from "@/components/leads/useLeadMutations";
import { useCvrRowMutations } from "@/components/leads/useCvrRowMutations";
import { STATUS_DEFS, statusLabel } from "@/lib/status";

// One combined "in progress" overview instead of two separate AI-lead and
// CVR panels — a person working the pipeline doesn't think in terms of
// which source a company was found through, so the status tabs (and the
// rows under them) merge both together into a single picture.
export function PipelineInProgress({
  companies,
  cvrCompanies,
  teamId,
  myName,
  initialLeads,
  initialStars,
  initialTeamLists,
  initialListMemberships,
}: {
  companies: Company[];
  cvrCompanies: CvrCompanyRow[];
  teamId: string;
  myName: string;
  initialLeads: Record<number, LeadState>;
  initialStars: number[];
  initialTeamLists: TeamListOption[];
  initialListMemberships: Record<number, string[]>;
}) {
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [cvrRows, setCvrRows] = useState(cvrCompanies);
  const [selectedCvr, setSelectedCvr] = useState<CvrCompanyRow | null>(null);
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

  const {
    teamLists: cvrTeamLists,
    analyzingFor,
    handleSetStatus: handleCvrSetStatus,
    handleAssign: handleCvrAssign,
    handleRelease: handleCvrRelease,
    handleToggleStar: handleCvrToggleStar,
    handleToggleList: handleCvrToggleList,
    handleCreateList: handleCvrCreateList,
    handleAnalyze,
  } = useCvrRowMutations({ teamId, myName, initialTeamLists, setRows: setCvrRows, setSelected: setSelectedCvr });

  // Re-applied client-side (not just the server's initial filter) so a
  // company set back to "new" with no assignee drops out immediately,
  // without a page reload — same rule both panels applied before merging.
  const activeLeads = companies.filter((c) => {
    const lead = leadOf(c.id);
    return lead.status !== "new" || lead.assigneeId;
  });
  const activeCvr = cvrRows.filter((c) => {
    const status = c.pipeline?.status ?? "new";
    return status !== "new" || c.pipeline?.assigneeId;
  });

  const counts: Record<string, number> = {};
  for (const c of activeLeads) {
    const status = leadOf(c.id).status;
    counts[status] = (counts[status] ?? 0) + 1;
  }
  for (const c of activeCvr) {
    const status = c.pipeline?.status ?? "new";
    counts[status] = (counts[status] ?? 0) + 1;
  }

  const visibleLeads = statusFilter ? activeLeads.filter((c) => leadOf(c.id).status === statusFilter) : [];
  const visibleCvr = statusFilter ? activeCvr.filter((c) => (c.pipeline?.status ?? "new") === statusFilter) : [];
  const selectedCompany = selectedLeadId != null ? companies.find((c) => c.id === selectedLeadId) ?? null : null;
  const total = activeLeads.length + activeCvr.length;

  if (total === 0) {
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
      ) : visibleLeads.length === 0 && visibleCvr.length === 0 ? (
        <div className="dash-empty">Ingen virksomheder i denne kategori.</div>
      ) : (
        <>
          {visibleLeads.map((c) => {
            const lead = leadOf(c.id);
            return (
              <button type="button" className="inprogress-row inprogress-row-clickable" key={`lead-${c.id}`} onClick={() => setSelectedLeadId(c.id)}>
                <span className="status-pill" data-status={lead.status}>
                  {statusLabel(lead.status)}
                </span>
                <b>{c.name}</b>
                <span className="tag">{c.industry}</span>
                {lead.assigneeName ? <span className="assignee-chip">👤 {lead.assigneeName}</span> : null}
              </button>
            );
          })}
          {visibleCvr.map((c) => (
            <button
              type="button"
              className="inprogress-row inprogress-row-clickable"
              key={`cvr-${c.cvrNummer}`}
              onClick={() => setSelectedCvr(c)}
            >
              <span className="status-pill" data-status={c.pipeline?.status ?? "new"}>
                {statusLabel(c.pipeline?.status ?? "new")}
              </span>
              <b>{c.navn || `CVR ${c.cvrNummer}`}</b>
              <span className="tag">{c.brancheLabel ?? "CVR"}</span>
              {c.pipeline?.assigneeName ? <span className="assignee-chip">👤 {c.pipeline.assigneeName}</span> : null}
            </button>
          ))}
        </>
      )}

      {selectedCompany ? (
        <LeadDrawer
          company={selectedCompany}
          lead={leadOf(selectedCompany.id)}
          starred={starred.has(selectedCompany.id)}
          teamLists={teamLists}
          listIds={new Set(listMemberships[selectedCompany.id] ?? [])}
          myName={myName}
          onClose={() => setSelectedLeadId(null)}
          onToggleStar={() => handleToggleStar(selectedCompany.id)}
          onSetStatus={(status) => handleSetStatus(selectedCompany.id, status)}
          onAssign={() => handleAssign(selectedCompany.id)}
          onRelease={() => handleRelease(selectedCompany.id)}
          onToggleList={(listId) => handleToggleList(selectedCompany.id, listId)}
          onCreateList={(name) => handleCreateList(selectedCompany.id, name)}
        />
      ) : null}

      {selectedCvr ? (
        <CvrDrawer
          company={selectedCvr}
          myName={myName}
          teamLists={cvrTeamLists}
          analyzing={analyzingFor === selectedCvr.cvrNummer}
          onClose={() => setSelectedCvr(null)}
          onToggleStar={() => handleCvrToggleStar(selectedCvr)}
          onSetStatus={(status) => handleCvrSetStatus(selectedCvr, status)}
          onAssign={() => handleCvrAssign(selectedCvr)}
          onRelease={() => handleCvrRelease(selectedCvr)}
          onToggleList={(listId) => handleCvrToggleList(selectedCvr, listId)}
          onCreateList={(name) => handleCvrCreateList(selectedCvr, name)}
          onAnalyze={() => handleAnalyze(selectedCvr)}
        />
      ) : null}
    </>
  );
}
