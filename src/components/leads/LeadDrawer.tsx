"use client";

import { useState } from "react";
import type { Company } from "@/lib/companies";
import { STATUS_DEFS, statusLabel } from "@/lib/status";
import type { LeadState } from "./LeadCard";
import { useToast } from "@/components/shared/ToastProvider";

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

export function LeadDrawer({
  company,
  lead,
  starred,
  myName,
  onClose,
  onToggleStar,
  onSetStatus,
  onAssign,
  onRelease,
}: {
  company: Company;
  lead: LeadState;
  starred: boolean;
  myName: string;
  onClose: () => void;
  onToggleStar: () => void;
  onSetStatus: (status: string) => void;
  onAssign: () => void;
  onRelease: () => void;
}) {
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const { showToast } = useToast();

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
            <h2>{company.name}</h2>
            <span className="tag">{company.industry}</span>
            <span className="tag">{company.website}</span>
          </div>
          <div className="drawer-head-actions">
            <button type="button" className={`star-btn drawer-star${starred ? " starred" : ""}`} aria-label="Stjernemarkér" title="Stjernemarkér" onClick={onToggleStar}>
              ★
            </button>
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
            <div className="status-menu" style={statusMenuOpen ? { position: "relative" } : { position: "relative" }}>
              <button type="button" className="status-pill" onClick={() => setStatusMenuOpen((v) => !v)}>
                {statusLabel(lead.status)} ▾
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
            {lead.assigneeName ? (
              <>
                <span className="assignee-chip">👤 Tildelt: {lead.assigneeName}</span>
                {lead.assigneeName === myName ? (
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

          <div className="section-label">Score-begrundelse</div>
          <div className="breakdown">
            <BdRow label="Kontakt" value={company.breakdown.contact} max={30} color="var(--accent)" />
            <BdRow label="Nyhedsvinkel" value={company.breakdown.news} max={35} color="var(--hot)" />
            <BdRow label="Branche-fit" value={company.breakdown.industry} max={20} color="var(--cool)" />
            <BdRow label="Kreativt potentiale" value={company.breakdown.creative} max={15} color="var(--star)" />
          </div>

          <div className="section-label">Vinklen — hvorfor nu</div>
          <div className="info-card">
            <div className="k">{company.hook.date}</div>
            <div className="v">
              <strong>{company.hook.title}</strong>
              <br />
              {company.hook.summary}
              <br />
              <a href={company.hook.url} target="_blank" rel="noopener noreferrer">
                Læs kilden ↗
              </a>
            </div>
          </div>

          <div className="section-label">Eksisterende reklame/indhold</div>
          <div className="prose-card">{company.existing}</div>

          <div className="section-label">Sociale medier</div>
          <div className="prose-card">{company.social}</div>

          <div className="section-label">Vores idé</div>
          <div className="idea-box">
            <div className="k">Konkret idé</div>
            {company.idea}
          </div>

          <div className="section-label">Kontakt</div>
          {company.contact.found ? (
            <div className="info-card">
              <div className="k">Navngivet kontakt</div>
              <div className="v">
                <strong>{company.contact.name}</strong> — {company.contact.title}
                {company.contact.profileUrl ? (
                  <>
                    {" "}
                    ·{" "}
                    <a href={company.contact.profileUrl} target="_blank" rel="noopener noreferrer">
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
          {company.contact.email ? (
            <div className="info-card">
              <div className="k">Mail</div>
              <div className="v">
                {company.contact.email}
                {company.contact.sourceUrl ? (
                  <>
                    {" "}
                    ·{" "}
                    <a href={company.contact.sourceUrl} target="_blank" rel="noopener noreferrer">
                      kilde ↗
                    </a>
                  </>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="info-card">
              <div className="v muted">Ingen offentlig mail fundet — brug kontaktformular eller LinkedIn.</div>
            </div>
          )}
          {company.contact.note ? (
            <div className="info-card">
              <div className="k">Bemærk</div>
              <div className="v">{company.contact.note}</div>
            </div>
          ) : null}

          <div className="section-label">Forslag til mail</div>
          <div className="mail-box">
            <div className="mail-subject">
              <span>Emne</span>
              {company.mail.subject}
            </div>
            <div className="mail-body">{company.mail.body}</div>
          </div>
          <div className="mail-actions">
            <button
              type="button"
              className="btn primary"
              onClick={(e) => copyText(`Emne: ${company.mail.subject}\n\n${company.mail.body}`, "Kopieret ✓", e.currentTarget)}
            >
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" strokeWidth="1.8" />
              </svg>
              Kopiér mail
            </button>
            {company.contact.email ? (
              <button type="button" className="btn" onClick={(e) => copyText(company.contact.email!, "Kopieret ✓", e.currentTarget)}>
                Kopiér adresse
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
