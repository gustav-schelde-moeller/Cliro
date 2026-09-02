"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Company } from "@/lib/companies";
import type { LeadState } from "@/components/leads/LeadCard";
import type { TeamListOption } from "@/components/leads/ListMenu";
import { LeadDrawer } from "@/components/leads/LeadDrawer";
import { useLeadMutations } from "@/components/leads/useLeadMutations";
import { useToast, errorMessage } from "@/components/shared/ToastProvider";
import { createListAction, deleteListAction, toggleCompanyInListAction } from "@/lib/actions/list-actions";

type ListItem = {
  id: string;
  name: string;
  createdAt: string;
  createdByName: string | null;
  companies: Company[];
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
  const [isPending, startTransition] = useTransition();
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

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
        setConfirmingDeleteId(null);
        router.refresh();
      } catch (err) {
        showToast(errorMessage(err, "Kunne ikke slette listen."));
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
                    {list.companies.length} {list.companies.length === 1 ? "virksomhed" : "virksomheder"}
                  </span>
                </div>
                <div className="list-header-actions" onClick={(e) => e.stopPropagation()}>
                  <a className="btn" href={`/api/lists/${list.id}/export`}>
                    Eksportér
                  </a>
                  {confirmingDeleteId === list.id ? (
                    <div className="delete-confirm-row">
                      <button type="button" className="btn" disabled={isPending} onClick={() => setConfirmingDeleteId(null)}>
                        Fortryd
                      </button>
                      <button type="button" className="btn danger" disabled={isPending} onClick={() => handleDelete(list.id)}>
                        {isPending ? "Sletter…" : "Ja, slet"}
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="btn danger" onClick={() => setConfirmingDeleteId(list.id)}>
                      Slet
                    </button>
                  )}
                </div>
              </div>
              {list.createdByName ? <div className="distance-note list-created-note">Oprettet af {list.createdByName}</div> : null}
              <div className={`list-body-wrap${isExpanded ? " expanded" : ""}`}>
                <div>
                  {list.companies.length === 0 ? (
                    <div className="dash-empty" style={{ marginTop: 12 }}>
                      Ingen virksomheder i denne liste endnu.
                    </div>
                  ) : (
                    <div className="list-table-wrap" style={{ marginTop: 12 }}>
                      <table className="list-table">
                        <thead>
                          <tr>
                            <th>Navn</th>
                            <th>Branche</th>
                            <th>By</th>
                            <th>Score</th>
                            <th>Kontakt</th>
                            <th>Email</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {list.companies.map((c) => (
                            <tr key={c.id} className="list-table-row" onClick={() => setSelectedId(c.id)}>
                              <td>{c.name}</td>
                              <td>{c.industry}</td>
                              <td>{c.city}</td>
                              <td>{c.score}</td>
                              <td>{c.contact.name ?? "—"}</td>
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
                        </tbody>
                      </table>
                    </div>
                  )}
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
