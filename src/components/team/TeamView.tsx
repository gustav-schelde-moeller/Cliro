"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/shared/Avatar";
import { Modal } from "@/components/shared/Modal";
import { useToast, errorMessage } from "@/components/shared/ToastProvider";
import { statusLabel } from "@/lib/status";
import { inviteEmailAction, removeMemberAction, setRoleAction, type ActionResult } from "@/lib/actions/team-actions";
import { toggleCompanyInListAction, toggleCvrCompanyInListAction } from "@/lib/actions/list-actions";
import type { Company } from "@/lib/companies";
import type { LeadState } from "@/components/leads/LeadCard";
import { LeadDrawer } from "@/components/leads/LeadDrawer";
import { useLeadMutations } from "@/components/leads/useLeadMutations";
import { CvrDrawer } from "@/components/leads/CvrDrawer";
import { useCvrRowMutations } from "@/components/leads/useCvrRowMutations";
import type { CvrCompanyRow } from "@/components/leads/CvrBrowser";
import type { TeamListOption } from "@/components/leads/ListMenu";
import { TeamListDrawer, type TeamListPreview } from "./TeamListDrawer";
import { ListIcon } from "@/components/lists/ListIcon";

type MemberLead = { id: number; name: string; industry: string; status: string };
type MemberCvrLead = { cvrNummer: string; name: string; industry: string; status: string };
type Member = {
  userId: string;
  name: string;
  email: string;
  avatarDataUrl: string | null;
  role: "admin" | "member";
  isOwner: boolean;
  stats: { total: number; won: number; meeting: number };
  leads: MemberLead[];
  cvrLeads: MemberCvrLead[];
};
type ActivityItem = { id: string; ts: string; who: string; action: string; company: string | null };

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "nu";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}t`;
  return `${Math.floor(h / 24)}d`;
}

const initialInviteState: ActionResult = {};

export function TeamView({
  teamId,
  teamName,
  teamCode,
  isAdmin,
  isOwner,
  myUserId,
  myName,
  members,
  activity,
  publicLists,
  allCompanies,
  allCvrCompanies,
  initialLeads,
  initialStars,
  initialTeamListOptions,
  initialListMemberships,
}: {
  teamId: string;
  teamName: string;
  teamCode: string;
  isAdmin: boolean;
  isOwner: boolean;
  myUserId: string;
  myName: string;
  members: Member[];
  activity: ActivityItem[];
  publicLists: TeamListPreview[];
  allCompanies: Company[];
  allCvrCompanies: CvrCompanyRow[];
  initialLeads: Record<number, LeadState>;
  initialStars: number[];
  initialTeamListOptions: TeamListOption[];
  initialListMemberships: Record<number, string[]>;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const inviteFormRef = useRef<HTMLFormElement>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [cvrRows, setCvrRows] = useState<CvrCompanyRow[]>(allCvrCompanies);
  const [selectedCvr, setSelectedCvr] = useState<CvrCompanyRow | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());

  function toggleMemberExpanded(userId: string) {
    setExpandedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  const {
    starred,
    teamLists,
    listMemberships,
    leadOf,
    handleToggleStar,
    handleSetStatus,
    handleSetFollowUp,
    handleAssign,
    handleRelease,
    handleToggleList,
    handleCreateList,
  } = useLeadMutations({ teamId, myName, initialLeads, initialStars, initialTeamLists: initialTeamListOptions, initialListMemberships });

  const {
    teamLists: cvrTeamLists,
    analyzingFor,
    handleSetStatus: handleCvrSetStatus,
    handleSetFollowUp: handleCvrSetFollowUp,
    handleAssign: handleCvrAssign,
    handleRelease: handleCvrRelease,
    handleToggleStar: handleCvrToggleStar,
    handleToggleList: handleCvrToggleList,
    handleCreateList: handleCvrCreateList,
    handleAnalyze,
  } = useCvrRowMutations({ teamId, myName, initialTeamLists: initialTeamListOptions, setRows: setCvrRows, setSelected: setSelectedCvr });

  const selectedCompany = selectedId != null ? allCompanies.find((c) => c.id === selectedId) ?? null : null;
  const selectedList = selectedListId != null ? publicLists.find((l) => l.id === selectedListId) ?? null : null;
  const openableCvrNummers = useMemo(() => new Set(cvrRows.map((r) => r.cvrNummer)), [cvrRows]);

  function openCvrByNummer(cvrNummer: string) {
    const match = cvrRows.find((r) => r.cvrNummer === cvrNummer);
    if (match) setSelectedCvr(match);
  }

  const [inviteState, inviteFormAction, invitePending] = useActionState(
    async (_prev: ActionResult, formData: FormData) => {
      const result = await inviteEmailAction(teamId, _prev, formData);
      if (result.ok) {
        showToast("Invitation sendt.");
        inviteFormRef.current?.reset();
      }
      return result;
    },
    initialInviteState
  );

  const [copiedCode, setCopiedCode] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(teamCode);
      setCopiedCode(true);
      showToast("Kode kopieret.");
      setTimeout(() => setCopiedCode(false), 1500);
    } catch {
      showToast(`Kunne ikke kopiere automatisk — koden er: ${teamCode}`);
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}/team-gate?join=${teamCode}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Invitationslink kopieret.");
    } catch {
      showToast(`Kunne ikke kopiere automatisk — koden er: ${teamCode}`);
    }
  }

  const [confirmRemove, setConfirmRemove] = useState<{ userId: string; name: string } | null>(null);

  function handleRemove(userId: string) {
    startTransition(async () => {
      try {
        await removeMemberAction(teamId, userId);
        router.refresh();
      } catch (err) {
        showToast(errorMessage(err, "Kunne ikke fjerne medlemmet."));
      } finally {
        setConfirmRemove(null);
      }
    });
  }

  function handleSetRole(userId: string, makeAdmin: boolean) {
    startTransition(async () => {
      try {
        await setRoleAction(teamId, userId, makeAdmin);
        router.refresh();
      } catch (err) {
        showToast(errorMessage(err, "Kunne ikke ændre rollen."));
      }
    });
  }

  const [removingCompany, removingStartTransition] = useTransition();

  function handleRemoveCompany(listId: string, companyId: number) {
    removingStartTransition(async () => {
      try {
        await toggleCompanyInListAction(teamId, listId, companyId);
        router.refresh();
      } catch (err) {
        showToast(errorMessage(err, "Kunne ikke fjerne virksomheden."));
      }
    });
  }

  function handleRemoveCvrCompany(listId: string, cvrNummer: string) {
    removingStartTransition(async () => {
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
      <div className="panel-card" style={{ marginBottom: 16 }}>
        <h3>
          Inviter til {teamName}
        </h3>
        <div className="invite-row">
          <div className="invite-code">{teamCode}</div>
          <button type="button" className={`btn${copiedCode ? " copied" : ""}`} onClick={copyCode}>
            Kopiér kode
          </button>
          <button type="button" className="btn" onClick={copyLink}>
            Kopiér invitationslink
          </button>
        </div>
        {isAdmin ? (
          <form ref={inviteFormRef} className="invite-email-row" action={inviteFormAction}>
            <input type="email" name="email" className="field" placeholder="kollega@firma.dk" required />
            <button type="submit" className="btn primary" disabled={invitePending}>
              {invitePending ? "Sender…" : "Send invitation via mail"}
            </button>
          </form>
        ) : null}
        {inviteState.error ? <p style={{ color: "var(--bad)", fontSize: 12.5, marginTop: 8 }}>{inviteState.error}</p> : null}
        <div className="distance-note" style={{ marginTop: 10 }}>
          Koden virker for alle, uanset hvilken computer de bruger.
        </div>
      </div>

      <div className="grid-cols">
        <div className="panel-card">
          <h3>Team ({members.length})</h3>
          {members.length === 0 ? (
            <div className="dash-empty">Ingen teammedlemmer endnu.</div>
          ) : (
            members.map((m) => {
              const badge = m.isOwner ? (
                <span className="admin-badge owner-badge">Ejer</span>
              ) : m.role === "admin" ? (
                <span className="admin-badge">Admin</span>
              ) : null;
              return (
                <div className="roster-row" key={m.userId}>
                  <div className="roster-name">
                    <Avatar name={m.name} avatarDataUrl={m.avatarDataUrl} size="sm" />
                    {m.name}
                    {m.userId === myUserId ? <span style={{ color: "var(--text-faint)", fontSize: 11 }}> (dig)</span> : null}
                    {badge}
                  </div>
                  <div className="roster-right">
                    <span className="roster-count">
                      {m.stats.total} tildelt · {m.stats.meeting} møde · {m.stats.won} vundet
                    </span>
                    {isOwner && !m.isOwner ? (
                      m.role === "admin" ? (
                        <button className="role-btn" disabled={isPending} onClick={() => handleSetRole(m.userId, false)}>
                          Fjern admin
                        </button>
                      ) : (
                        <button className="role-btn" disabled={isPending} onClick={() => handleSetRole(m.userId, true)}>
                          Gør til admin
                        </button>
                      )
                    ) : null}
                    {isAdmin && !m.isOwner && m.userId !== myUserId ? (
                      <button
                        className="role-btn"
                        disabled={isPending}
                        onClick={() => setConfirmRemove({ userId: m.userId, name: m.name })}
                      >
                        Fjern
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="panel-card">
          <h3>Aktivitetslog</h3>
          <div className="activity-feed">
            {activity.length === 0 ? (
              <div className="dash-empty">Ingen aktivitet endnu.</div>
            ) : (
              activity.map((a) => (
                <div className="activity-row" key={a.id}>
                  <span className="activity-time">{timeAgo(a.ts)}</span>
                  <span className="activity-text">
                    <b>{a.who}</b> {a.action}
                    {a.company ? <b> {a.company}</b> : null}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="panel-card" style={{ marginTop: 16 }}>
        <h3>Overblik pr. teammedlem</h3>
        {members.length === 0 ? (
          <div className="dash-empty">Ingen teammedlemmer endnu.</div>
        ) : (
          members.map((m) => {
            const memberTotal = m.leads.length + m.cvrLeads.length;
            const isExpanded = expandedMembers.has(m.userId);
            return (
              <div className="member-block" key={m.userId}>
                <div
                  className="member-block-head"
                  onClick={() => memberTotal > 0 && toggleMemberExpanded(m.userId)}
                  style={memberTotal > 0 ? { cursor: "pointer" } : undefined}
                >
                  {memberTotal > 0 ? (
                    <svg
                      className={`list-chevron${isExpanded ? " open" : ""}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      width={14}
                      height={14}
                    >
                      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                  <Avatar name={m.name} avatarDataUrl={m.avatarDataUrl} size="sm" />
                  <b>{m.name}</b>
                  <span className="tag">{memberTotal} tildelt</span>
                </div>
                {memberTotal > 0 ? (
                  <div className={`list-body-wrap${isExpanded ? " expanded" : ""}`}>
                    <div>
                      <div className="member-leads">
                        {m.leads.map((l) => (
                          <div className="member-lead-row" key={l.id} onClick={() => setSelectedId(l.id)}>
                            <span className="status-pill" data-status={l.status}>
                              {statusLabel(l.status)}
                            </span>
                            <span>{l.name}</span>
                            <span className="tag">{l.industry}</span>
                          </div>
                        ))}
                        {m.cvrLeads.map((l) => (
                          <div className="member-lead-row" key={l.cvrNummer} onClick={() => openCvrByNummer(l.cvrNummer)}>
                            <span className="status-pill" data-status={l.status}>
                              {statusLabel(l.status)}
                            </span>
                            <span className="tag">CVR</span>
                            <span>{l.name}</span>
                            <span className="tag">{l.industry}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <div className="panel-card" style={{ marginTop: 16 }}>
        <h3>Alle team-lister</h3>
        {publicLists.length === 0 ? (
          <div className="dash-empty">Ingen synlige lister endnu. Opret en på Lister-siden og gør den synlig for teamet.</div>
        ) : (
          <div className="list">
            {publicLists.map((l, i) => {
              const itemCount = l.companies.length + l.cvrCompanies.length;
              const meta = [
                `${itemCount} ${itemCount === 1 ? "virksomhed" : "virksomheder"}`,
                l.createdByName ? `Oprettet af ${l.createdByName}` : null,
                formatDate(l.createdAt),
              ].filter(Boolean);
              return (
                <div
                  className={`panel-card list-card list-card-anim${l.isMine ? " mine" : ""}`}
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                  onClick={() => setSelectedListId(l.id)}
                  key={l.id}
                >
                  <div className="list-card-head">
                    <ListIcon />
                    <div className="list-card-main">
                      <div className="list-card-title-row">
                        <h3 className="list-card-title">{l.name}</h3>
                      </div>
                      <div className="list-card-meta">{meta.join(" · ")}</div>
                    </div>
                    <svg className="list-chevron" viewBox="0 0 24 24" fill="none" width={16} height={16}>
                      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="footer-note">Den første person i et team er automatisk ejer og kan gøre andre til admin herfra.</div>

      {confirmRemove ? (
        <Modal title={`Fjern ${confirmRemove.name}?`} onClose={() => setConfirmRemove(null)}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
            {confirmRemove.name} fjernes fra teamet med det samme. Alle lister {confirmRemove.name} har oprettet, og alle
            virksomheder tildelt {confirmRemove.name}, forsvinder også permanent — det kan ikke fortrydes.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button type="button" className="btn" onClick={() => setConfirmRemove(null)}>
              Annullér
            </button>
            <button type="button" className="btn danger" disabled={isPending} onClick={() => handleRemove(confirmRemove.userId)}>
              Ja, fjern permanent
            </button>
          </div>
        </Modal>
      ) : null}

      {selectedList ? (
        <TeamListDrawer
          list={selectedList}
          openableCvrNummers={openableCvrNummers}
          removing={removingCompany}
          nestedDrawerOpen={selectedCompany != null || selectedCvr != null}
          onClose={() => setSelectedListId(null)}
          onOpenCompany={(id) => setSelectedId(id)}
          onOpenCvrCompany={openCvrByNummer}
          onRemoveCompany={(id) => handleRemoveCompany(selectedList.id, id)}
          onRemoveCvrCompany={(cvrNummer) => handleRemoveCvrCompany(selectedList.id, cvrNummer)}
        />
      ) : null}

      {/* A company drawer opened from inside TeamListDrawer needs to outrank
          that modal's own panel entirely — its own scrim, not just its
          panel. .scrim is z-index:40 and .modal-panel/.drawer are both
          z-index:41, so a plain DOM-order tie-break only lifts the drawer's
          *panel* above the modal (they're both 41); the drawer's *scrim*
          (40) never outranks the modal's panel (41) no matter where it
          sits in the DOM, since z-index comparisons only fall back to DOM
          order within equal values. This wrapper's own z-index (50)
          promotes the whole scrim+panel pair as one unit above the modal,
          so clicking anywhere over the dimmed modal correctly hits the
          drawer's scrim and closes it. */}
      {selectedCompany || selectedCvr ? (
        <div style={{ position: "relative", zIndex: 50 }}>
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
              onSetFollowUp={(date) => handleSetFollowUp(selectedCompany.id, date)}
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
              onSetFollowUp={(date) => handleCvrSetFollowUp(selectedCvr, date)}
              onAssign={() => handleCvrAssign(selectedCvr)}
              onRelease={() => handleCvrRelease(selectedCvr)}
              onToggleList={(listId) => handleCvrToggleList(selectedCvr, listId)}
              onCreateList={(name) => handleCvrCreateList(selectedCvr, name)}
              onAnalyze={() => handleAnalyze(selectedCvr)}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
