"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { displayScore, displayTier, type Company } from "@/lib/companies";
import { STATUS_DEFS } from "@/lib/status";
import { followUpRelative, formatFollowUpDate } from "@/lib/followup";
import { LeadDrawer } from "@/components/leads/LeadDrawer";
import { CvrDrawer } from "@/components/leads/CvrDrawer";
import type { LeadState } from "@/components/leads/LeadCard";
import type { CvrCompanyRow } from "@/components/leads/CvrBrowser";
import type { TeamListOption } from "@/components/leads/ListMenu";
import { useLeadMutations } from "@/components/leads/useLeadMutations";
import { useCvrRowMutations } from "@/components/leads/useCvrRowMutations";

type BoardItem = {
  key: string;
  name: string;
  sub: string | null;
  score: number | null;
  status: string;
  assigneeId: string | null;
  assigneeName: string | null;
  followUpAt: string | null;
};

// Overdue/soonest follow-ups first, then everything without one, by name.
function compareItems(a: BoardItem, b: BoardItem): number {
  if (a.followUpAt && b.followUpAt) return a.followUpAt.localeCompare(b.followUpAt);
  if (a.followUpAt) return -1;
  if (b.followUpAt) return 1;
  return a.name.localeCompare(b.name, "da");
}

export function PipelineBoard({
  companies,
  cvrCompanies,
  teamId,
  myName,
  myUserId,
  initialLeads,
  initialStars,
  initialTeamLists,
  initialListMemberships,
  openKey,
}: {
  companies: Company[];
  cvrCompanies: CvrCompanyRow[];
  teamId: string;
  myName: string;
  myUserId: string;
  initialLeads: Record<number, LeadState>;
  initialStars: number[];
  initialTeamLists: TeamListOption[];
  initialListMemberships: Record<number, string[]>;
  openKey: string | null;
}) {
  const router = useRouter();
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(() =>
    openKey?.startsWith("lead-") ? Number(openKey.slice(5)) : null,
  );
  const [cvrRows, setCvrRows] = useState(cvrCompanies);
  const [selectedCvr, setSelectedCvr] = useState<CvrCompanyRow | null>(() =>
    openKey?.startsWith("cvr-") ? (cvrCompanies.find((r) => r.cvrNummer === openKey.slice(4)) ?? null) : null,
  );
  const [onlyMine, setOnlyMine] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);

  const {
    starred,
    teamLists,
    listMemberships,
    leadOf,
    handleToggleStar,
    handleSetStatus,
    handleSetFollowUp,
    handleAssign,
    handleRelease,
    handleToggleList,
    handleCreateList,
  } = useLeadMutations({ teamId, myName, initialLeads, initialStars, initialTeamLists, initialListMemberships });

  const {
    teamLists: cvrTeamLists,
    analyzingFor,
    handleSetStatus: handleCvrSetStatus,
    handleSetFollowUp: handleCvrSetFollowUp,
    handleAssign: handleCvrAssign,
    handleRelease: handleCvrRelease,
    handleToggleStar: handleCvrToggleStar,
    handleToggleList: handleCvrToggleList,
    handleCreateList: handleCvrCreateList,
    handleAnalyze,
  } = useCvrRowMutations({ teamId, myName, initialTeamLists, setRows: setCvrRows, setSelected: setSelectedCvr });

  // "me" is the optimistic stand-in for the current user until the server
  // round-trip replaces it with the real id.
  const isMine = (assigneeId: string | null) => assigneeId === myUserId || assigneeId === "me";

  const allItems: BoardItem[] = [
    ...companies.map((c) => {
      const lead = leadOf(c.id);
      return {
        key: `lead-${c.id}`,
        name: c.name,
        sub: c.industry,
        score: displayScore(c),
        status: lead.status,
        assigneeId: lead.assigneeId,
        assigneeName: lead.assigneeName,
        followUpAt: lead.followUpAt,
      };
    }),
    ...cvrRows.map((r) => ({
      key: `cvr-${r.cvrNummer}`,
      name: r.navn || `CVR ${r.cvrNummer}`,
      sub: r.brancheLabel,
      score: null,
      status: r.pipeline?.status ?? "new",
      assigneeId: r.pipeline?.assigneeId ?? null,
      assigneeName: r.pipeline?.assigneeName ?? null,
      followUpAt: r.pipeline?.followUpAt ?? null,
    })),
  ]
    // Same "actually in the pipeline" rule the server loaded with, re-applied
    // so a company set back to Ny with nobody on it drops off immediately.
    .filter((i) => i.status !== "new" || i.assigneeId);
  const items = onlyMine ? allItems.filter((i) => isMine(i.assigneeId)) : allItems;

  const selectedCompany = selectedLeadId != null ? (companies.find((c) => c.id === selectedLeadId) ?? null) : null;

  function openItem(key: string) {
    if (key.startsWith("lead-")) {
      setSelectedCvr(null);
      setSelectedLeadId(Number(key.slice(5)));
    } else {
      setSelectedLeadId(null);
      setSelectedCvr(cvrRows.find((r) => r.cvrNummer === key.slice(4)) ?? null);
    }
  }

  function closeDrawer() {
    setSelectedLeadId(null);
    setSelectedCvr(null);
    // Drop a notification's ?open= target so a later click on the same
    // notification opens it again.
    if (openKey) router.replace("/pipeline", { scroll: false });
  }

  function moveTo(key: string, status: string) {
    const item = allItems.find((i) => i.key === key);
    if (!item || item.status === status) return;
    if (key.startsWith("lead-")) {
      handleSetStatus(Number(key.slice(5)), status);
    } else {
      const row = cvrRows.find((r) => r.cvrNummer === key.slice(4));
      if (row) handleCvrSetStatus(row, status);
    }
  }

  function renderCard(item: BoardItem) {
    const rel = item.followUpAt ? followUpRelative(item.followUpAt) : null;
    return (
      <div
        key={item.key}
        className={`board-card${dragKey === item.key ? " dragging" : ""}`}
        role="button"
        tabIndex={0}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", item.key);
          e.dataTransfer.effectAllowed = "move";
          setDragKey(item.key);
        }}
        onDragEnd={() => {
          setDragKey(null);
          setOverColumn(null);
        }}
        onClick={() => openItem(item.key)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openItem(item.key);
          }
        }}
      >
        <div className="board-card-top">
          <b className="board-card-name">{item.name}</b>
          {item.score != null ? (
            <span className={`board-score tier-${displayTier(item.score)}`}>{item.score}</span>
          ) : (
            <span className="board-kind">CVR</span>
          )}
        </div>
        {item.sub ? <div className="board-card-sub">{item.sub}</div> : null}
        <div className="board-card-meta">
          {item.assigneeName ? (
            <span className="board-assignee">{item.assigneeName}</span>
          ) : (
            <span className="board-assignee muted">Ikke tildelt</span>
          )}
          {rel && item.followUpAt ? (
            <span className={`followup-chip ${rel.state}`} title={`Følg op ${formatFollowUpDate(item.followUpAt)}`}>
              {rel.label}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <section>
      <div className="board-toolbar">
        <div className="segmented">
          <button type="button" className={onlyMine ? "" : "active"} onClick={() => setOnlyMine(false)}>
            Alle ({allItems.length})
          </button>
          <button type="button" className={onlyMine ? "active" : ""} onClick={() => setOnlyMine(true)}>
            Kun mine ({allItems.filter((i) => isMine(i.assigneeId)).length})
          </button>
        </div>
        <span className="distance-note board-hint">Træk et kort over i en anden kolonne for at skifte status.</span>
      </div>

      {allItems.length === 0 ? (
        <div className="panel-card">
          <div className="dash-empty">
            Ingen virksomheder i pipelinen endnu. Sæt en status eller tildel dig selv en virksomhed, så dukker den op her.
          </div>
        </div>
      ) : (
        <div className="board-wrap">
          <div className="board">
            {STATUS_DEFS.map((s) => {
              const columnItems = items.filter((i) => i.status === s.key).sort(compareItems);
              return (
                <section
                  key={s.key}
                  className={`board-col${overColumn === s.key ? " drop-target" : ""}`}
                  onDragOver={(e) => {
                    if (!dragKey) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (overColumn !== s.key) setOverColumn(s.key);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                      setOverColumn((c) => (c === s.key ? null : c));
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const key = e.dataTransfer.getData("text/plain");
                    setOverColumn(null);
                    setDragKey(null);
                    if (key) moveTo(key, s.key);
                  }}
                >
                  <header className="board-col-head">
                    <span className={`status-dot ${s.key}`} />
                    {s.label}
                    <span className="board-count">{columnItems.length}</span>
                  </header>
                  <div className="board-col-body">
                    {columnItems.length === 0 ? <div className="board-empty">Træk en virksomhed hertil</div> : columnItems.map(renderCard)}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {selectedCompany ? (
        <LeadDrawer
          company={selectedCompany}
          lead={leadOf(selectedCompany.id)}
          starred={starred.has(selectedCompany.id)}
          teamLists={teamLists}
          listIds={new Set(listMemberships[selectedCompany.id] ?? [])}
          myName={myName}
          onClose={closeDrawer}
          onToggleStar={() => handleToggleStar(selectedCompany.id)}
          onSetStatus={(status) => handleSetStatus(selectedCompany.id, status)}
          onSetFollowUp={(date) => handleSetFollowUp(selectedCompany.id, date)}
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
          onClose={closeDrawer}
          onToggleStar={() => handleCvrToggleStar(selectedCvr)}
          onSetStatus={(status) => handleCvrSetStatus(selectedCvr, status)}
          onSetFollowUp={(date) => handleCvrSetFollowUp(selectedCvr, date)}
          onAssign={() => handleCvrAssign(selectedCvr)}
          onRelease={() => handleCvrRelease(selectedCvr)}
          onToggleList={(listId) => handleCvrToggleList(selectedCvr, listId)}
          onCreateList={(name) => handleCvrCreateList(selectedCvr, name)}
          onAnalyze={() => handleAnalyze(selectedCvr)}
        />
      ) : null}
    </section>
  );
}
