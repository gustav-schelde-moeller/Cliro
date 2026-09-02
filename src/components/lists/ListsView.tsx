"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Company } from "@/lib/companies";
import { useToast, errorMessage } from "@/components/shared/ToastProvider";
import { createListAction, deleteListAction, toggleCompanyInListAction } from "@/lib/actions/list-actions";

type ListItem = {
  id: string;
  name: string;
  createdAt: string;
  createdByName: string | null;
  companies: Company[];
};

export function ListsView({ teamId, lists }: { teamId: string; lists: ListItem[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  function toggleCollapsed(id: string) {
    setCollapsed((prev) => {
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
      <div className="panel-card" style={{ marginBottom: 16 }}>
        <h3>Ny liste</h3>
        <div className="invite-email-row">
          <input
            type="text"
            className="field"
            placeholder='Fx "Denne uges ringerunde"'
            value={newName}
            maxLength={60}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
          />
          <button type="button" className="btn primary" disabled={creating || !newName.trim()} onClick={handleCreate}>
            {creating ? "Opretter…" : "Opret liste"}
          </button>
        </div>
        <div className="distance-note" style={{ marginTop: 10 }}>
          Lister deles med hele teamet — alle kan tilføje og fjerne virksomheder.
        </div>
      </div>

      {lists.length === 0 ? (
        <div className="panel-card">
          <div className="dash-empty">
            Ingen lister endnu. Opret en ovenfor, eller tilføj en virksomhed til en ny liste direkte fra en virksomheds kort på
            Virksomheder-siden.
          </div>
        </div>
      ) : (
        lists.map((list) => {
          const isCollapsed = collapsed.has(list.id);
          return (
            <div className="panel-card" style={{ marginBottom: 16 }} key={list.id}>
              <div className="list-header-row" onClick={() => toggleCollapsed(list.id)}>
                <div>
                  <h3 style={{ display: "inline-block", marginRight: 8 }}>{list.name}</h3>
                  <span className="tag">
                    {list.companies.length} {list.companies.length === 1 ? "virksomhed" : "virksomheder"}
                  </span>
                  {list.createdByName ? (
                    <div className="distance-note">Oprettet af {list.createdByName}</div>
                  ) : null}
                </div>
                <div className="list-header-actions" onClick={(e) => e.stopPropagation()}>
                  <a className="btn" href={`/api/lists/${list.id}/export`}>
                    Eksportér CSV
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
                      Slet liste
                    </button>
                  )}
                </div>
              </div>
              {!isCollapsed ? (
                list.companies.length === 0 ? (
                  <div className="dash-empty" style={{ marginTop: 12 }}>
                    Ingen virksomheder i denne liste endnu.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto", marginTop: 12 }}>
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
                          <tr key={c.id}>
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
                                onClick={() => handleRemoveCompany(list.id, c.id)}
                              >
                                Fjern
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : null}
            </div>
          );
        })
      )}
    </section>
  );
}
