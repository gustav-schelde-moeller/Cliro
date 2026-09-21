"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { displayScore, type Company } from "@/lib/companies";
import type { LeadState } from "@/components/leads/LeadCard";
import type { TeamListOption } from "@/components/leads/ListMenu";
import { LeadDrawer } from "@/components/leads/LeadDrawer";
import { useLeadMutations } from "@/components/leads/useLeadMutations";
import { useToast, errorMessage } from "@/components/shared/ToastProvider";
import {
  createListAction,
  deleteListAction,
  toggleCompanyInListAction,
  toggleCvrCompanyInListAction,
  toggleListVisibilityAction,
} from "@/lib/actions/list-actions";
import { ListActionsMenu } from "./ListActionsMenu";

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
  isMine: boolean;
  companies: Company[];
  cvrCompanies: CvrListCompany[];
};

export function ListsView({
  teamId,
  myName,
  lists,
  initialLeads,
  initialStars,
  initialTeamLists,
  initialListMemberships,
}: {
  teamId: string;
  myName: string;
  lists: ListItem[];
  initialLeads: Record<number, LeadState>;
  initialStars: number[];
  initialTeamLists: TeamListOption[];
  initialListMemberships: Record<number, string[]>;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  // Team's "Alle team-lister" links here with ?list=<id> so the linked list
  // opens already expanded instead of the user having to find and click it
  // again.
  const searchParams = useSearchParams();
  const openListId = searchParams.get("list");
  const [isPending, startTransition] = useTransition();
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(openListId ? [openListId] : []));
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (!openListId) return;
    document.getElementById(`list-${openListId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    // Only ever needs to run once for the link that brought us here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const companyById = useMemo(() => {
    const map = new Map<number, Company>();
    for (const list of lists) for (const c of list.companies) map.set(c.id, c);
    return map;
  }, [lists]);
  const selectedCompany = selectedId != null ? companyById.get(selectedId) ?? null : null;

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
        lists.map((list, i) => {
          const isExpanded = expandedIds.has(list.id);
          return (
            <div
              id={`list-${list.id}`}
              className="panel-card list-card-anim"
              style={{ marginBottom: 16, animationDelay: `${Math.min(i, 8) * 40}ms` }}
              key={list.id}
            >
              <div className="list-header-row" onClick={() => toggleExpanded(list.id)}>
                <div className="list-header-title">
                  <svg
                    className={`list-chevron${isExpanded ? " open" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    width={14}
                    height={14}
                  >
                    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <h3 className="list-name-link">{list.name}</h3>
                  <span className="tag">
                    {list.companies.length + list.cvrCompanies.length} {list.companies.length + list.cvrCompanies.length === 1 ? "virksomhed" : "virksomheder"}
                  </span>
                  {list.isPrivate ? <span className="tag">🔒 Privat</span> : null}
                </div>
                <div className="list-header-actions" onClick={(e) => e.stopPropagation()}>
                  <ListActionsMenu
                    listId={list.id}
                    listName={list.name}
                    isPrivate={list.isPrivate}
                    isMine={list.isMine}
                    onToggleVisibility={() => handleToggleVisibility(list.id)}
                    onDelete={() => handleDelete(list.id)}
                  />
                </div>
              </div>
              {list.createdByName ? <div className="distance-note list-created-note">Oprettet af {list.createdByName}</div> : null}
              <div className={`list-body-wrap${isExpanded ? " expanded" : ""}`}>
                <div>
                  {list.companies.length === 0 && list.cvrCompanies.length === 0 ? (
                    <div className="dash-empty" style={{ marginTop: 12 }}>
                      Ingen virksomheder i denne liste endnu.
                    </div>
                  ) : null}
                  {list.companies.length > 0 || list.cvrCompanies.length > 0 ? (
                    <div className="list-table-wrap" style={{ marginTop: 12 }}>
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
                            <tr key={`lead-${c.id}`} className="list-table-row" onClick={() => setSelectedId(c.id)}>
                              <td>{c.name}</td>
                              <td>{c.industry}</td>
                              <td>{c.city}</td>
                              <td>{displayScore(c)}</td>
                              <td>—</td>
                              <td>{c.contact.name ?? "—"}</td>
                              <td>—</td>
                              <td>{c.contact.email ?? "—"}</td>
                              <td>
                                <button
                                  type="button"
                                  className="btn"
                                  disabled={isPending}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveCompany(list.id, c.id);
                                  }}
                                >
                                  Fjern
                                </button>
                              </td>
                            </tr>
                          ))}
                          {list.cvrCompanies.map((c) => (
                            <tr key={`cvr-${c.cvrNummer}`} className="list-table-row">
                              <td>{c.navn || "Ukendt navn"}</td>
                              <td>{c.brancheTekst ?? "—"}</td>
                              <td>{c.kommunenavn ?? "—"}</td>
                              <td>—</td>
                              <td>{c.koebekraftScore ?? "—"}</td>
                              <td>—</td>
                              <td>{c.telefon ?? "—"}</td>
                              <td>{c.email ?? "—"}</td>
                              <td>
                                <button
                                  type="button"
                                  className="btn"
                                  disabled={isPending}
                                  onClick={() => handleRemoveCvrCompany(list.id, c.cvrNummer)}
                                >
                                  Fjern
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })
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
    </section>
  );
}
