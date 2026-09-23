"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { displayScore, displayTier, type Company } from "@/lib/companies";
import { STATUS_DEFS } from "@/lib/status";
import { daysUntil, followUpRelative, formatFollowUpDate } from "@/lib/followup";
import { Avatar } from "@/components/shared/Avatar";
import { canEditPipeline, isViewer, useViewer } from "@/components/shared/ViewerContext";
import { LeadDrawer } from "@/components/leads/LeadDrawer";
import { CvrDrawer } from "@/components/leads/CvrDrawer";
import type { LeadState } from "@/components/leads/LeadCard";
import type { CvrCompanyRow } from "@/components/leads/CvrBrowser";
import type { TeamListOption } from "@/components/leads/ListMenu";
import { useLeadMutations } from "@/components/leads/useLeadMutations";
import { useCvrRowMutations } from "@/components/leads/useCvrRowMutations";

export type BoardMember = { userId: string; name: string; avatarDataUrl: string | null };

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

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={12} height={12} aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={11} height={11} aria-hidden>
      <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function PipelineBoard({
  companies,
  cvrCompanies,
  members,
  teamId,
  myName,
  initialLeads,
  initialStars,
  initialTeamLists,
  initialListMemberships,
  openKey,
}: {
  companies: Company[];
  cvrCompanies: CvrCompanyRow[];
  members: BoardMember[];
  teamId: string;
  myName: string;
  initialLeads: Record<number, LeadState>;
  initialStars: number[];
  initialTeamLists: TeamListOption[];
  initialListMemberships: Record<number, string[]>;
  openKey: string | null;
}) {
  const router = useRouter();
  const viewer = useViewer();
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

  const avatarOf = (assigneeId: string | null) =>
    members.find((m) => m.userId === (assigneeId === "me" ? viewer.userId : assigneeId))?.avatarDataUrl ?? null;

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
  const mine = allItems.filter((i) => isViewer(viewer, i.assigneeId));
  const items = onlyMine ? mine : allItems;
  const dueCount = mine.filter((i) => i.followUpAt && daysUntil(i.followUpAt) <= 0).length;

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
    if (!item || item.status === status || !canEditPipeline(viewer, item.assigneeId)) return;
    // Admins rearrange the board on the team's behalf, so moving a card
    // never makes it theirs; a member moving an unassigned card claims it,
    // same as changing its status anywhere else.
    const options = { claim: !viewer.isAdmin };
    if (key.startsWith("lead-")) {
      handleSetStatus(Number(key.slice(5)), status, options);
    } else {
      const row = cvrRows.find((r) => r.cvrNummer === key.slice(4));
      if (row) handleCvrSetStatus(row, status, options);
    }
  }

  function renderCard(item: BoardItem) {
    const rel = item.followUpAt ? followUpRelative(item.followUpAt) : null;
    const movable = canEditPipeline(viewer, item.assigneeId);
    const isMineCard = isViewer(viewer, item.assigneeId);
    return (
      <div
        key={item.key}
        className={`board-card${dragKey === item.key ? " dragging" : ""}${movable ? "" : " locked"}${isMineCard ? " mine" : ""}`}
        role="button"
        tabIndex={0}
        draggable={movable}
        title={movable ? undefined : `Tildelt ${item.assigneeName ?? "en kollega"} — kun de eller en admin kan flytte den`}
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
            <span className={`board-score tier-${displayTier(item.score)}`} title="Score">
              {item.score}
            </span>
          ) : (
            <span className="board-kind">CVR</span>
          )}
        </div>
        {item.sub ? <div className="board-card-sub">{item.sub}</div> : null}
        <div className="board-card-foot">
          {item.assigneeName ? (
            <span className="board-owner">
              <Avatar name={item.assigneeName} avatarDataUrl={avatarOf(item.assigneeId)} size="sm" />
              <span>{isMineCard ? "Dig" : item.assigneeName.split(" ")[0]}</span>
            </span>
          ) : (
            <span className="board-owner muted">
              <span className="board-owner-empty" aria-hidden />
              Ikke tildelt
            </span>
          )}
          <span className="board-card-flags">
            {rel && item.followUpAt ? (
              <span className={`followup-chip ${rel.state}`} title={`Følg op ${formatFollowUpDate(item.followUpAt)}`}>
                <CalendarIcon />
                {rel.label}
              </span>
            ) : null}
            {movable ? null : (
              <span className="board-lock">
                <LockIcon />
              </span>
            )}
          </span>
        </div>
      </div>
    );
  }

  return (
    <section>
      <div className="board-toolbar">
        <div className="segmented">
          <button type="button" className={onlyMine ? "" : "active"} onClick={() => setOnlyMine(false)}>
            Hele teamet <span className="seg-count">{allItems.length}</span>
          </button>
          <button type="button" className={onlyMine ? "active" : ""} onClick={() => setOnlyMine(true)}>
            Mine <span className="seg-count">{mine.length}</span>
          </button>
        </div>
        {dueCount > 0 ? (
          <span className="followup-chip today board-due">
            <CalendarIcon />
            {dueCount === 1 ? "1 opfølgning i dag" : `${dueCount} opfølgninger i dag`}
          </span>
        ) : null}
        <span className="board-hint">
          {viewer.isAdmin
            ? "Som admin kan du flytte alle kort — de bliver ikke tildelt dig."
            : "Træk dine egne eller ikke-tildelte kort mellem kolonnerne."}
        </span>
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
                  data-status={s.key}
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
                    <span className="board-col-title">{s.label}</span>
                    <span className="board-count">{columnItems.length}</span>
                  </header>
                  <div className="board-col-body">
                    {columnItems.length === 0 ? (
                      <div className="board-empty">{dragKey ? "Slip her" : "Ingen virksomheder"}</div>
                    ) : (
                      columnItems.map(renderCard)
                    )}
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
