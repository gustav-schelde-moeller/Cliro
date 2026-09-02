"use client";

import type { Company } from "@/lib/companies";
import { statusLabel } from "@/lib/status";
import { ListMenu, type TeamListOption } from "./ListMenu";

export type LeadState = { status: string; assigneeId: string | null; assigneeName: string | null };
export type { TeamListOption };

export function LeadCard({
  company,
  lead,
  starred,
  isNew,
  teamLists,
  listIds,
  distanceKm,
  index,
  onOpen,
  onToggleStar,
  onAssign,
  onToggleList,
  onCreateList,
}: {
  company: Company;
  lead: LeadState;
  starred: boolean;
  isNew?: boolean;
  teamLists: TeamListOption[];
  listIds: Set<string>;
  distanceKm: number | null;
  index: number;
  onOpen: () => void;
  onToggleStar: () => void;
  onAssign: () => void;
  onToggleList: (listId: string) => void;
  onCreateList: (name: string) => void;
}) {
  return (
    <div
      className="card"
      role="button"
      tabIndex={0}
      aria-label={`Åbn ${company.name}`}
      style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <button
        type="button"
        className={`star-btn card-star${starred ? " starred" : ""}`}
        aria-label={`Stjernemarkér ${company.name}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleStar();
        }}
      >
        {starred ? "★" : "☆"}
      </button>
      <ListMenu
        className="card-list-menu"
        companyName={company.name}
        teamLists={teamLists}
        listIds={listIds}
        onToggleList={onToggleList}
        onCreateList={onCreateList}
      />
      <div className={`score-badge tier-${company.tier.key}`}>
        <b>{company.score}</b>
        <span>score</span>
      </div>
      <div className="card-main">
        <div className="card-title-row">
          <h3>{company.name}</h3>
          <span className="tag">{company.industry}</span>
          {isNew ? <span className="new-badge">Ny</span> : null}
        </div>
        <div className="card-news">
          <b>{company.hook.title}</b> — {company.hook.summary}
        </div>
        {company.contact.found ? (
          <div className="card-contact-line">
            <b>{company.contact.name}</b> · {company.contact.title}
            {company.contact.email ? " · direkte mail" : ""}
          </div>
        ) : (
          <div className="card-contact-line">Ingen navngiven kontakt fundet</div>
        )}
        <div className="card-team-row">
          <span className="status-pill" data-status={lead.status}>
            {statusLabel(lead.status)}
          </span>
          {lead.assigneeName ? (
            <span className="assignee-chip">👤 {lead.assigneeName}</span>
          ) : (
            <button
              type="button"
              className="assign-btn"
              onClick={(e) => {
                e.stopPropagation();
                onAssign();
              }}
            >
              Tildel til mig
            </button>
          )}
        </div>
      </div>
      <div className="card-meta">
        <div className="badge-row">
          <span className={`mini-badge${company.contact.found ? " on" : ""}`}>{company.contact.found ? "✓ navn" : "– navn"}</span>
          <span className={`mini-badge${company.contact.email ? " on" : ""}`}>{company.contact.email ? "✓ mail" : "– mail"}</span>
        </div>
        <time>{company.hook.date}</time>
        {distanceKm != null ? <span className="card-dist">{Math.round(distanceKm)} km</span> : null}
      </div>
    </div>
  );
}
