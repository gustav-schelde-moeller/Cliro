"use client";

import { displayScore, type Company } from "@/lib/companies";

type CvrListCompany = {
  cvrNummer: string;
  navn: string | null;
  brancheTekst: string | null;
  kommunenavn: string | null;
  email: string | null;
  telefon: string | null;
  koebekraftScore: number | null;
};

export type TeamListPreview = {
  id: string;
  name: string;
  createdAt: string;
  createdByName: string | null;
  companies: Company[];
  cvrCompanies: CvrListCompany[];
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

// A read-only preview of a list's contents, opened from Team's "Alle
// team-lister" — same .scrim/.drawer overlay every other drawer in the app
// uses, so it slides in on the right and the Team page stays put. AI leads
// are clickable (their full Company data is already on hand); CVR
// companies only are when `openableCvrNummers` says a full CvrCompanyRow
// for them is actually loaded (Team only fetches CVR rows that already
// have a status/assignee, not every CVR company ever added to a list).
export function TeamListDrawer({
  list,
  openableCvrNummers,
  onClose,
  onOpenCompany,
  onOpenCvrCompany,
}: {
  list: TeamListPreview;
  openableCvrNummers: Set<string>;
  onClose: () => void;
  onOpenCompany: (companyId: number) => void;
  onOpenCvrCompany: (cvrNummer: string) => void;
}) {
  const total = list.companies.length + list.cvrCompanies.length;

  return (
    <>
      <div className="scrim open" onClick={onClose} />
      <div className="drawer open">
        <div className="drawer-head">
          <div>
            <h2>{list.name}</h2>
            <span className="tag">
              {total} {total === 1 ? "virksomhed" : "virksomheder"}
            </span>
            {list.createdByName ? (
              <div className="distance-note" style={{ marginTop: 6 }}>
                Oprettet af {list.createdByName} · {formatDate(list.createdAt)}
              </div>
            ) : null}
          </div>
          <div className="drawer-head-actions">
            <button type="button" className="drawer-close" aria-label="Luk" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" width={16} height={16}>
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
        <div className="drawer-body">
          {total === 0 ? (
            <div className="dash-empty">Ingen virksomheder i denne liste endnu.</div>
          ) : (
            <div className="list-table-wrap">
              <table className="list-table">
                <thead>
                  <tr>
                    <th>Navn</th>
                    <th>Branche</th>
                    <th>By</th>
                    <th>Score</th>
                    <th>Købekraft</th>
                  </tr>
                </thead>
                <tbody>
                  {list.companies.map((c) => (
                    <tr key={`lead-${c.id}`} className="list-table-row" onClick={() => onOpenCompany(c.id)}>
                      <td>{c.name}</td>
                      <td>{c.industry}</td>
                      <td>{c.city}</td>
                      <td>{displayScore(c)}</td>
                      <td>—</td>
                    </tr>
                  ))}
                  {list.cvrCompanies.map((c) => {
                    const openable = openableCvrNummers.has(c.cvrNummer);
                    return (
                      <tr
                        key={`cvr-${c.cvrNummer}`}
                        className={`list-table-row${openable ? "" : " list-table-row-disabled"}`}
                        onClick={openable ? () => onOpenCvrCompany(c.cvrNummer) : undefined}
                      >
                        <td>{c.navn || "Ukendt navn"}</td>
                        <td>{c.brancheTekst ?? "—"}</td>
                        <td>{c.kommunenavn ?? "—"}</td>
                        <td>—</td>
                        <td>{c.koebekraftScore ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
