"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { displayScore, type Company } from "@/lib/companies";
import type { LeadState } from "@/components/leads/LeadCard";
import type { TeamListOption } from "@/components/leads/ListMenu";
import { LeadDrawer } from "@/components/leads/LeadDrawer";
import { useLeadMutations } from "@/components/leads/useLeadMutations";
import { CvrDrawer } from "@/components/leads/CvrDrawer";
import { useCvrRowMutations } from "@/components/leads/useCvrRowMutations";
import type { CvrCompanyRow } from "@/components/leads/CvrBrowser";
import { useToast, errorMessage } from "@/components/shared/ToastProvider";
import {
  createListAction,
  deleteListAction,
  toggleCompanyInListAction,
  toggleCvrCompanyInListAction,
  toggleListVisibilityAction,
  toggleListTeamEditAction,
} from "@/lib/actions/list-actions";
import { ListActionsMenu } from "./ListActionsMenu";
import { ListIcon } from "./ListIcon";

type CvrListCompany = {
  cvrNummer: string;
  navn: string | null;
  brancheTekst: string | null;
  kommunenavn: string | null;
  email: string | null;
  telefon: string | null;
  koebekraftScore: number | null;
};

type ListItem = {
  id: string;
  name: string;
  createdAt: string;
  createdByName: string | null;
  isPrivate: boolean;
  teamCanEdit: boolean;
  isMine: boolean;
  companies: Company[];
  cvrCompanies: CvrListCompany[];
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export function ListsView({
  teamId,
  myName,
  lists,
  initialLeads,
  initialStars,
  initialTeamLists,
  initialListMemberships,
  allCvrCompanies,
}: {
  teamId: string;
  myName: string;
  lists: ListItem[];
  initialLeads: Record<number, LeadState>;
  initialStars: number[];
  initialTeamLists: TeamListOption[];
  initialListMemberships: Record<number, string[]>;
  allCvrCompanies: CvrCompanyRow[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [cvrRows, setCvrRows] = useState<CvrCompanyRow[]>(allCvrCompanies);
  const [selectedCvr, setSelectedCvr] = useState<CvrCompanyRow | null>(null);

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

  const companyById = useMemo(() => {
    const map = new Map<number, Company>();
    for (const list of lists) for (const c of list.companies) map.set(c.id, c);
    return map;
  }, [lists]);
  const selectedCompany = selectedId != null ? companyById.get(selectedId) ?? null : null;
  // AI leads and CVR companies open into two independent drawers
  // (LeadDrawer / CvrDrawer), so without this a row click while the other
  // kind's drawer is already open would open both at once — two
  // independent scrims stacking. Rows are inert until the open one closes.
  const companyDrawerOpen = selectedCompany != null || selectedCvr != null;

  function openCvrByNummer(cvrNummer: string) {
    const match = cvrRows.find((r) => r.cvrNummer === cvrNummer);
    if (match) setSelectedCvr(match);
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await createListAction(teamId, name);
      setNewName("");
      setCreatingOpen(false);
      router.refresh();
    } catch (err) {
      showToast(errorMessage(err, "Kunne ikke oprette listen."));
    } finally {
      setCreating(false);
    }
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteListAction(teamId, id);
        router.refresh();
      } catch (err) {
        showToast(errorMessage(err, "Kunne ikke slette listen."));
      }
    });
  }

  function handleToggleVisibility(listId: string) {
    startTransition(async () => {
      try {
        await toggleListVisibilityAction(teamId, listId);
        router.refresh();
      } catch (err) {
        showToast(errorMessage(err, "Kunne ikke ændre synligheden."));
      }
    });
  }

  function handleToggleTeamEdit(listId: string) {
    startTransition(async () => {
      try {
        await toggleListTeamEditAction(teamId, listId);
        router.refresh();
      } catch (err) {
        showToast(errorMessage(err, "Kunne ikke ændre redigeringsadgangen."));
      }
    });
  }

  function handleRemoveCompany(listId: string, companyId: number) {
    startTransition(async () => {
      try {
        await toggleCompanyInListAction(teamId, listId, companyId);
        router.refresh();
      } catch (err) {
        showToast(errorMessage(err, "Kunne ikke fjerne virksomheden."));
      }
    });
  }

  function handleRemoveCvrCompany(listId: string, cvrNummer: string) {
    startTransition(async () => {
      try {
        await toggleCvrCompanyInListAction(teamId, listId, cvrNummer);
        router.refresh();
      } catch (err) {
        showToast(errorMessage(err, "Kunne ikke fjerne virksomheden."));
      }
    });
  }

  const sections = [
    { key: "mine", title: "Mine lister", items: lists.filter((l) => l.isMine), empty: "Du har ikke oprettet nogen lister endnu." },
    { key: "team", title: "Team-lister", items: lists.filter((l) => !l.isMine), empty: "Ingen andre i teamet har delt en liste endnu." },
  ];

  function renderList(list: ListItem, i: number) {
    const isExpanded = expandedIds.has(list.id);
    const canEdit = list.isMine || (!list.isPrivate && list.teamCanEdit);
    const total = list.companies.length + list.cvrCompanies.length;
    const meta = [
      `${total} ${total === 1 ? "virksomhed" : "virksomheder"}`,
      !list.isMine && list.createdByName ? `Oprettet af ${list.createdByName}` : null,
      formatDate(list.createdAt),
    ].filter(Boolean);
    return (
      <div
        className={`panel-card list-card list-card-anim${isExpanded ? " expanded" : ""}${list.isMine ? " mine" : ""}`}
        style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
        key={list.id}
      >
        <div className="list-card-head" onClick={() => toggleExpanded(list.id)}>
          <ListIcon />
          <div className="list-card-main">
            <div className="list-card-title-row">
              <h3 className="list-card-title">{list.name}</h3>
              {list.isPrivate ? <span className="tag">🔒 Privat</span> : null}
            </div>
            <div className="list-card-meta">{meta.join(" · ")}</div>
          </div>
          <div className="list-header-actions" onClick={(e) => e.stopPropagation()}>
            <ListActionsMenu
              listId={list.id}
              listName={list.name}
              isPrivate={list.isPrivate}
              isMine={list.isMine}
              teamCanEdit={list.teamCanEdit}
              onToggleVisibility={() => handleToggleVisibility(list.id)}
              onToggleTeamEdit={() => handleToggleTeamEdit(list.id)}
              onDelete={() => handleDelete(list.id)}
            />
          </div>
          <svg className={`list-chevron${isExpanded ? " open" : ""}`} viewBox="0 0 24 24" fill="none" width={16} height={16}>
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className={`list-body-wrap${isExpanded ? " expanded" : ""}`}>
          <div className="list-card-body">
            {list.companies.length === 0 && list.cvrCompanies.length === 0 ? (
              <div className="dash-empty">Ingen virksomheder i denne liste endnu.</div>
            ) : null}
            {list.companies.length > 0 || list.cvrCompanies.length > 0 ? (
              <div className="list-table-wrap">
                <table className="list-table saved-list-table">
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
                        className={`list-table-row${companyDrawerOpen ? " list-table-row-disabled" : ""}`}
                        onClick={companyDrawerOpen ? undefined : () => setSelectedId(c.id)}
                      >
                        <td className="cell-primary" data-label="Navn">{c.name}</td>
                        <td data-label="Branche">{c.industry}</td>
                        <td data-label="By">{c.city}</td>
                        <td data-label="Score">{displayScore(c)}</td>
                        <td className="cell-na" data-label="Købekraft">—</td>
                        <td data-label="Kontakt">{c.contact.name ?? "—"}</td>
                        <td className="cell-na" data-label="Telefon">—</td>
                        <td data-label="Email">{c.contact.email ?? "—"}</td>
                        <td>
                          {canEdit ? (
                            <button
                              type="button"
                              className="btn"
                              disabled={isPending || companyDrawerOpen}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveCompany(list.id, c.id);
                              }}
                            >
                              Fjern
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                    {list.cvrCompanies.map((c) => {
                      const openable = cvrRows.some((r) => r.cvrNummer === c.cvrNummer) && !companyDrawerOpen;
                      return (
                        <tr
                          key={`cvr-${c.cvrNummer}`}
                          className={`list-table-row${openable ? "" : " list-table-row-disabled"}`}
                          onClick={openable ? () => openCvrByNummer(c.cvrNummer) : undefined}
                        >
                          <td className="cell-primary" data-label="Navn">{c.navn || "Ukendt navn"}</td>
                          <td data-label="Branche">{c.brancheTekst ?? "—"}</td>
                          <td data-label="By">{c.kommunenavn ?? "—"}</td>
                          <td className="cell-na" data-label="Score">—</td>
                          <td data-label="Købekraft">{c.koebekraftScore ?? "—"}</td>
                          <td className="cell-na" data-label="Kontakt">—</td>
                          <td data-label="Telefon">{c.telefon ?? "—"}</td>
                          <td data-label="Email">{c.email ?? "—"}</td>
                          <td>
                            {canEdit ? (
                              <button
                                type="button"
                                className="btn"
                                disabled={isPending || companyDrawerOpen}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveCvrCompany(list.id, c.cvrNummer);
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
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <section>
      <div className="lists-create-bar">
        {creatingOpen ? (
          <div className="invite-email-row">
            <input
              type="text"
              className="field"
              placeholder='Fx "Denne uges ringerunde"'
              value={newName}
              maxLength={60}
              autoFocus
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") {
                  setCreatingOpen(false);
                  setNewName("");
                }
              }}
            />
            <button type="button" className="btn primary" disabled={creating || !newName.trim()} onClick={handleCreate}>
              {creating ? "Opretter…" : "Opret"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setCreatingOpen(false);
                setNewName("");
              }}
            >
              Annullér
            </button>
          </div>
        ) : (
          <button type="button" className="btn primary" onClick={() => setCreatingOpen(true)}>
            + Ny liste
          </button>
        )}
      </div>

      {lists.length === 0 ? (
        <div className="panel-card list-card-anim">
          <div className="dash-empty">
            Ingen lister endnu. Opret en ovenfor, eller tilføj en virksomhed til en ny liste direkte fra en virksomheds kort på
            Virksomheder-siden.
          </div>
        </div>
      ) : (
        sections.map((section) => (
          <div key={section.key} className="lists-section">
            <div className="lists-section-head">
              <span>{section.title}</span>
              <span className="lists-section-count">{section.items.length}</span>
            </div>
            {section.items.length === 0 ? (
              <div className="lists-section-empty">{section.empty}</div>
            ) : (
              <div className="list">{section.items.map(renderList)}</div>
            )}
          </div>
        ))
      )}

      {selectedCompany ? (
        <LeadDrawer
          company={selectedCompany}
          lead={leadOf(selectedCompany.id)}
          starred={starred.has(selectedCompany.id)}
          teamLists={teamLists}
          listIds={new Set(listMemberships[selectedCompany.id] ?? [])}
          myName={myName}
          onClose={() => setSelectedId(null)}
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
    </section>
  );
}
