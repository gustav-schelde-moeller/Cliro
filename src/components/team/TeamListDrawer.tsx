"use client";

import { displayScore, type Company } from "@/lib/companies";
import { Modal } from "@/components/shared/Modal";

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
  isMine: boolean;
  teamCanEdit: boolean;
  companies: Company[];
  cvrCompanies: CvrListCompany[];
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

// A preview of a list's contents, opened from Team's "Alle team-lister" —
// same centered .modal-panel every other modal in the app uses, and the
// same table columns/markup ListsView shows when you expand a list on the
// actual Lister page, so this reads as "the same window", just reachable
// without leaving Team. AI leads are always clickable (their full Company
// data is already on hand); CVR companies only are when `openableCvrNummers`
// says a full CvrCompanyRow for them is actually loaded.
export function TeamListDrawer({
  list,
  openableCvrNummers,
  removing,
  nestedDrawerOpen,
  onClose,
  onOpenCompany,
  onOpenCvrCompany,
  onRemoveCompany,
  onRemoveCvrCompany,
}: {
  list: TeamListPreview;
  openableCvrNummers: Set<string>;
  removing: boolean;
  // True while a company's own drawer (opened from a row below) is showing
  // on top of this one. AI leads and CVR companies open into two
  // independent drawers (LeadDrawer / CvrDrawer), so without this a second
  // row click while the first drawer is still open would open both at
  // once — two independent scrims stacking, doubling the dimming and
  // stacking one drawer visually on top of the other. Rows are inert
  // until the open one is closed.
  nestedDrawerOpen: boolean;
  onClose: () => void;
  onOpenCompany: (companyId: number) => void;
  onOpenCvrCompany: (cvrNummer: string) => void;
  onRemoveCompany: (companyId: number) => void;
  onRemoveCvrCompany: (cvrNummer: string) => void;
}) {
  const total = list.companies.length + list.cvrCompanies.length;
  // Team only ever shows public lists here, so isPrivate never applies —
  // edit access is the owner, or anyone if the owner left teamCanEdit on.
  const canEdit = list.isMine || list.teamCanEdit;

  return (
    <Modal
      title={list.name}
      subtitle={
        <>
          {total} {total === 1 ? "virksomhed" : "virksomheder"}
          {list.createdByName ? ` · Oprettet af ${list.createdByName} · ${formatDate(list.createdAt)}` : ""}
        </>
      }
      onClose={onClose}
      maxWidth={920}
      dimmed={nestedDrawerOpen}
    >
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
                <th>Kontakt</th>
                <th>Telefon</th>
                <th>Email</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.companies.map((c) => (
                <tr
                  key={`lead-${c.id}`}
                  className={`list-table-row${nestedDrawerOpen ? " list-table-row-disabled" : ""}`}
                  onClick={nestedDrawerOpen ? undefined : () => onOpenCompany(c.id)}
                >
                  <td className="cell-primary" data-label="Navn">{c.name}</td>
                  <td data-label="Branche">{c.industry}</td>
                  <td data-label="By">{c.city}</td>
                  <td data-label="Score">{displayScore(c)}</td>
                  <td data-label="Købekraft">—</td>
                  <td data-label="Kontakt">{c.contact.name ?? "—"}</td>
                  <td data-label="Telefon">—</td>
                  <td data-label="Email">{c.contact.email ?? "—"}</td>
                  <td>
                    {canEdit ? (
                      <button
                        type="button"
                        className="btn"
                        disabled={removing || nestedDrawerOpen}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveCompany(c.id);
                        }}
                      >
                        Fjern
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {list.cvrCompanies.map((c) => {
                const openable = openableCvrNummers.has(c.cvrNummer) && !nestedDrawerOpen;
                return (
                  <tr
                    key={`cvr-${c.cvrNummer}`}
                    className={`list-table-row${openable ? "" : " list-table-row-disabled"}`}
                    onClick={openable ? () => onOpenCvrCompany(c.cvrNummer) : undefined}
                  >
                    <td className="cell-primary" data-label="Navn">{c.navn || "Ukendt navn"}</td>
                    <td data-label="Branche">{c.brancheTekst ?? "—"}</td>
                    <td data-label="By">{c.kommunenavn ?? "—"}</td>
                    <td data-label="Score">—</td>
                    <td data-label="Købekraft">{c.koebekraftScore ?? "—"}</td>
                    <td data-label="Kontakt">—</td>
                    <td data-label="Telefon">{c.telefon ?? "—"}</td>
                    <td data-label="Email">{c.email ?? "—"}</td>
                    <td>
                      {canEdit ? (
                        <button
                          type="button"
                          className="btn"
                          disabled={removing || nestedDrawerOpen}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveCvrCompany(c.cvrNummer);
                          }}
                        >
                          Fjern
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
