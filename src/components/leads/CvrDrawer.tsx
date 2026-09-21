"use client";

import { useState } from "react";
import { STATUS_DEFS, statusLabel } from "@/lib/status";
import { useToast } from "@/components/shared/ToastProvider";
import { ListMenu, type TeamListOption } from "./ListMenu";
import type { CvrCompanyRow } from "./CvrBrowser";

function formatKr(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(n) + " kr.";
}

function BdRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="bd-row">
      <span>{label}</span>
      <div className="bd-track">
        <div className="bd-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <b>
        {value}/{max}
      </b>
    </div>
  );
}

export function CvrDrawer({
  company,
  myName,
  teamLists,
  analyzing,
  onClose,
  onToggleStar,
  onSetStatus,
  onAssign,
  onRelease,
  onToggleList,
  onCreateList,
  onAnalyze,
}: {
  company: CvrCompanyRow;
  myName: string;
  teamLists: TeamListOption[];
  analyzing: boolean;
  onClose: () => void;
  onToggleStar: () => void;
  onSetStatus: (status: string) => void;
  onAssign: () => void;
  onRelease: () => void;
  onToggleList: (listId: string) => void;
  onCreateList: (name: string) => void;
  onAnalyze: () => void;
}) {
  const { showToast } = useToast();
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const pipeline = company.pipeline ?? { status: "new", assigneeId: null, assigneeName: null };
  const address = [company.vejnavn, company.husnummer].filter(Boolean).join(" ");
  const analysis = company.analysis;

  async function copyText(text: string, label: string, btn: HTMLButtonElement) {
    try {
      await navigator.clipboard.writeText(text);
      const original = btn.textContent;
      btn.classList.add("copied");
      btn.textContent = label;
      setTimeout(() => {
        btn.classList.remove("copied");
        btn.textContent = original;
      }, 1500);
    } catch {
      showToast(`Kunne ikke kopiere automatisk — teksten er: ${text.slice(0, 60)}${text.length > 60 ? "…" : ""}`);
    }
  }

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
          <div className="section-label" style={{ marginTop: 0 }}>
            Pipeline
          </div>
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

          <div className="section-label">AI-analyse</div>
          {!analysis && !analyzing ? (
            <div className="idea-box">
              <div className="k">Ingen analyse endnu</div>
              Kør en AI-research på denne virksomhed — finder en nyhedsvinkel, tjekker eksisterende marketing og sociale medier,
              foreslår en kreativ idé, og skriver et udkast til en cold-mail. Samme slags research som AI Leads bruger.
            </div>
          ) : null}
          <div className="mail-actions" style={{ marginTop: 10 }}>
            <button type="button" className="btn primary" disabled={analyzing} onClick={onAnalyze}>
              {analyzing ? "Analyserer… (kan tage op til et minut)" : analysis ? "Analysér igen" : "Analysér med AI"}
            </button>
          </div>

          {analysis ? (
            <div className="panel-card" style={{ animation: "cardIn 0.32s ease both", marginTop: 14 }}>
              <div className="section-label" style={{ marginTop: 0 }}>
                Score-begrundelse
              </div>
              <div className="breakdown">
                <BdRow label="Kontakt" value={analysis.breakdown.contact} max={30} color="var(--accent)" />
                <BdRow label="Nyhedsvinkel" value={analysis.breakdown.news} max={35} color="var(--hot)" />
                <BdRow label="Branche-fit" value={analysis.breakdown.industry} max={20} color="var(--cool)" />
                <BdRow label="Kreativt potentiale" value={analysis.breakdown.creative} max={15} color="var(--star)" />
              </div>

              <div className="section-label">Vinklen — hvorfor nu</div>
              {analysis.hook ? (
                <div className="info-card">
                  <div className="k">{analysis.hook.date}</div>
                  <div className="v">
                    <strong>{analysis.hook.title}</strong>
                    <br />
                    {analysis.hook.summary}
                    <br />
                    <a href={analysis.hook.url} target="_blank" rel="noopener noreferrer">
                      Læs kilden ↗
                    </a>
                  </div>
                </div>
              ) : (
                <div className="info-card">
                  <div className="v muted">Ingen specifik nyhedsvinkel fundet — idéen nedenfor er bygget på virksomhedens profil.</div>
                </div>
              )}

              <div className="section-label">Eksisterende reklame/indhold</div>
              <div className="prose-card">{analysis.existing}</div>

              <div className="section-label">Sociale medier</div>
              <div className="prose-card">{analysis.social}</div>

              <div className="section-label">Vores idé</div>
              <div className="idea-box">
                <div className="k">Konkret idé</div>
                {analysis.idea}
              </div>

              <div className="section-label">Kontakt (AI-fundet)</div>
              {analysis.contact.found ? (
                <div className="info-card">
                  <div className="k">Navngivet kontakt</div>
                  <div className="v">
                    <strong>{analysis.contact.name}</strong> — {analysis.contact.title}
                    {analysis.contact.profileUrl ? (
                      <>
                        {" "}
                        ·{" "}
                        <a href={analysis.contact.profileUrl} target="_blank" rel="noopener noreferrer">
                          kilde ↗
                        </a>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="info-card">
                  <div className="v muted">Ingen navngiven marketing-/brandansvarlig fundet.</div>
                </div>
              )}
              {analysis.contact.email ? (
                <div className="info-card">
                  <div className="k">Mail</div>
                  <div className="v">
                    {analysis.contact.email}
                    {analysis.contact.sourceUrl ? (
                      <>
                        {" "}
                        ·{" "}
                        <a href={analysis.contact.sourceUrl} target="_blank" rel="noopener noreferrer">
                          kilde ↗
                        </a>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {analysis.contact.note ? (
                <div className="info-card">
                  <div className="k">Bemærk</div>
                  <div className="v">{analysis.contact.note}</div>
                </div>
              ) : null}

              <div className="section-label">Forslag til mail</div>
              <div className="mail-box">
                <div className="mail-subject">
                  <span>Emne</span>
                  {analysis.mail.subject}
                </div>
                <div className="mail-body">{analysis.mail.body}</div>
              </div>
              <div className="mail-actions">
                <button
                  type="button"
                  className="btn primary"
                  onClick={(e) => copyText(`Emne: ${analysis.mail.subject}\n\n${analysis.mail.body}`, "Kopieret ✓", e.currentTarget)}
                >
                  <svg viewBox="0 0 24 24" fill="none">
                    <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                  Kopiér mail
                </button>
                {analysis.contact.email ? (
                  <button type="button" className="btn" onClick={(e) => copyText(analysis.contact.email!, "Kopieret ✓", e.currentTarget)}>
                    Kopiér adresse
                  </button>
                ) : null}
              </div>
              <div className="distance-note" style={{ marginTop: 10 }}>
                Analyseret {new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(analysis.analyzedAt))}
              </div>
            </div>
          ) : null}

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
