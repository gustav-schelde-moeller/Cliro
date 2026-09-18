"use client";

import { STAGE_LABELS, type CvrCompanyRow } from "./CvrBrowser";

const STAGE_ORDER = ["kontaktet", "svar", "mode", "pipeline"] as const;

function formatKr(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(n) + " kr.";
}

export function CvrDrawer({
  company,
  onClose,
  onToggleStar,
  onSetStage,
}: {
  company: CvrCompanyRow;
  onClose: () => void;
  onToggleStar: () => void;
  onSetStage: (stage: string | null) => void;
}) {
  const starred = company.lead?.starred ?? false;
  const stage = company.lead?.stage ?? null;
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
            <button type="button" className={`star-btn drawer-star${starred ? " starred" : ""}`} aria-label="Stjernemarkér" title="Stjernemarkér" onClick={onToggleStar}>
              {starred ? "★" : "☆"}
            </button>
            <button type="button" className="drawer-close" aria-label="Luk" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" width={16} height={16}>
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
        <div className="drawer-body">
          <div className="section-label">Status</div>
          <div className="drawer-pipeline">
            <div className="filter-row">
              <button type="button" className={`chip${stage === null ? " active" : ""}`} onClick={() => onSetStage(null)}>
                Ingen status
              </button>
              {STAGE_ORDER.map((s) => (
                <button key={s} type="button" className={`chip${stage === s ? " tier-active" : ""}`} onClick={() => onSetStage(s)}>
                  {STAGE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="section-label">Registreringsoplysninger</div>
          <div className="info-card">
            <div className="k">Adresse</div>
            <div className="v">
              {address || "—"}
              {company.postnummer ? `, ${company.postnummer} ${company.postdistrikt ?? ""}` : ""}
              <br />
              {company.kommunenavn ?? "—"} · {company.region ?? "Ukendt region"}
            </div>
          </div>
          <div className="info-card">
            <div className="k">Kontakt</div>
            <div className="v">
              {company.email ?? "Ingen mail registreret"}
              {company.telefon ? <>{" · "}{company.telefon}</> : null}
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
                <div
                  className="bd-fill"
                  style={{ width: `${company.koebekraftScore ?? 0}%`, background: "var(--star)" }}
                />
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
