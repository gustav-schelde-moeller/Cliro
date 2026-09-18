"use client";

import { useState } from "react";
import { STATUS_DEFS, statusLabel } from "@/lib/status";
import { ListMenu, type TeamListOption } from "./ListMenu";
import type { CvrCompanyRow } from "./CvrBrowser";

function formatKr(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(n) + " kr.";
}

export function CvrDrawer({
  company,
  myName,
  teamLists,
  onClose,
  onToggleStar,
  onSetStatus,
  onAssign,
  onRelease,
  onToggleList,
  onCreateList,
}: {
  company: CvrCompanyRow;
  myName: string;
  teamLists: TeamListOption[];
  onClose: () => void;
  onToggleStar: () => void;
  onSetStatus: (status: string) => void;
  onAssign: () => void;
  onRelease: () => void;
  onToggleList: (listId: string) => void;
  onCreateList: (name: string) => void;
}) {
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const pipeline = company.pipeline ?? { status: "new", assigneeId: null, assigneeName: null };
  const address = [company.vejnavn, company.husnummer].filter(Boolean).join(" ");

  return (
    <>
      <div className="scrim open" onClick={onClose} />
      <div className="drawer open">
        <div className="drawer-head">
          <div>
            <h2>{company.navn || "Ukendt navn"}</h2>
            <span className="tag">{company.brancheLabel || company.brancheTekst || "Ukendt branche"}</span>
            <span className="tag">CVR {company.cvrNummer}</span>
          </div>
          <div className="drawer-head-actions">
            <button
              type="button"
              className={`star-btn drawer-star${company.starred ? " starred" : ""}`}
              aria-label="Stjernemarkér"
              title="Stjernemarkér"
              onClick={onToggleStar}
            >
              {company.starred ? "★" : "☆"}
            </button>
            <ListMenu
              className="drawer-list-menu"
              companyName={company.navn || `CVR ${company.cvrNummer}`}
              teamLists={teamLists}
              listIds={new Set(company.listIds)}
              onToggleList={onToggleList}
              onCreateList={onCreateList}
            />
            <button type="button" className="drawer-close" aria-label="Luk" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" width={16} height={16}>
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
        <div className="drawer-body">
          <div className="section-label">Pipeline</div>
          <div className="drawer-pipeline">
            <div className="status-menu">
              <button type="button" className="status-pill" onClick={() => setStatusMenuOpen((v) => !v)}>
                {statusLabel(pipeline.status)} ▾
              </button>
              {statusMenuOpen ? (
                <div className="status-dropdown" style={{ display: "flex" }}>
                  {STATUS_DEFS.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      className="status-opt"
                      onClick={() => {
                        setStatusMenuOpen(false);
                        onSetStatus(s.key);
                      }}
                    >
                      <span className={`status-dot ${s.key}`} />
                      {s.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="drawer-assign">
            {pipeline.assigneeName ? (
              <>
                <span className="assignee-chip">👤 Tildelt: {pipeline.assigneeName}</span>
                {pipeline.assigneeName === myName ? (
                  <button type="button" className="btn" onClick={onRelease}>
                    Frigiv
                  </button>
                ) : null}
              </>
            ) : (
              <button type="button" className="btn primary" onClick={onAssign}>
                Tildel til mig
              </button>
            )}
          </div>

          <div className="section-label">Registreringsoplysninger</div>
          <div className="info-card">
            <div className="k">Adresse</div>
            <div className="v">
              {address || "—"}
              {company.postnummer ? `, ${company.postnummer} ${company.postdistrikt ?? ""}` : ""}
              <br />
              {company.kommunenavn ?? "—"} · {company.region ?? "Ukendt region"}
              {company.distanceKm != null ? ` · ${Math.round(company.distanceKm)} km fra dig` : ""}
            </div>
          </div>
          <div className="info-card">
            <div className="k">Kontakt</div>
            <div className="v">
              {company.email ?? "Ingen mail registreret"}
              {company.telefon ? (
                <>
                  {" · "}
                  {company.telefon}
                </>
              ) : null}
            </div>
          </div>
          <div className="info-card">
            <div className="k">Virksomhedsform</div>
            <div className="v">{company.virksomhedsformTekst ?? "—"}</div>
          </div>

          <div className="section-label">Størrelse & Købekraft</div>
          <div className="breakdown">
            <div className="bd-row">
              <span>Medarbejdere</span>
              <div className="bd-track">
                <div className="bd-fill" style={{ width: company.employees ? "100%" : "0%", background: "var(--accent)" }} />
              </div>
              <b>{company.employees ?? "Ukendt"}</b>
            </div>
            <div className="bd-row">
              <span>Købekraft</span>
              <div className="bd-track">
                <div className="bd-fill" style={{ width: `${company.koebekraftScore ?? 0}%`, background: "var(--star)" }} />
              </div>
              <b>{company.koebekraftScore ?? "—"}</b>
            </div>
          </div>

          <div className="section-label">Seneste regnskab {company.regnskabAar ? `(${company.regnskabAar})` : ""}</div>
          <div className="info-card">
            <div className="k">Egenkapital</div>
            <div className="v">{formatKr(company.egenkapital)}</div>
          </div>
          <div className="info-card">
            <div className="k">Driftsresultat</div>
            <div className="v">{formatKr(company.driftsresultat)}</div>
          </div>
          <div className="info-card">
            <div className="k">Nettoresultat</div>
            <div className="v">{formatKr(company.nettoresultat)}</div>
          </div>
          <div className="info-card">
            <div className="k">Likvide beholdninger</div>
            <div className="v">{formatKr(company.likvideBeholdninger)}</div>
          </div>
        </div>
      </div>
    </>
  );
}
