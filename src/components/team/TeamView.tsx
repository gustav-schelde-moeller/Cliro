"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/shared/Avatar";
import { useToast, errorMessage } from "@/components/shared/ToastProvider";
import { statusLabel } from "@/lib/status";
import { inviteEmailAction, removeMemberAction, setRoleAction, type ActionResult } from "@/lib/actions/team-actions";
import type { Company } from "@/lib/companies";
import type { LeadState } from "@/components/leads/LeadCard";
import { LeadDrawer } from "@/components/leads/LeadDrawer";
import { useLeadMutations } from "@/components/leads/useLeadMutations";
import { CvrDrawer } from "@/components/leads/CvrDrawer";
import { useCvrRowMutations } from "@/components/leads/useCvrRowMutations";
import type { CvrCompanyRow } from "@/components/leads/CvrBrowser";
import type { TeamListOption } from "@/components/leads/ListMenu";
import { TeamListDrawer, type TeamListPreview } from "./TeamListDrawer";

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
  } = useLeadMutations({ teamId, myName, initialLeads, initialStars, initialTeamLists: initialTeamListOptions, initialListMemberships });

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

  function handleRemove(userId: string) {
    startTransition(async () => {
      try {
        await removeMemberAction(teamId, userId);
        router.refresh();
      } catch (err) {
        showToast(errorMessage(err, "Kunne ikke fjerne medlemmet."));
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
                      <button className="role-btn" disabled={isPending} onClick={() => handleRemove(m.userId)}>
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
          members.map((m) => (
            <div className="member-block" key={m.userId}>
              <div className="member-block-head">
                <Avatar name={m.name} avatarDataUrl={m.avatarDataUrl} size="sm" />
                <b>{m.name}</b>
                <span className="tag">{m.leads.length + m.cvrLeads.length} tildelt</span>
              </div>
              {m.leads.length > 0 || m.cvrLeads.length > 0 ? (
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
              ) : null}
            </div>
          ))
        )}
      </div>

      <div className="panel-card" style={{ marginTop: 16 }}>
        <h3>Alle team-lister</h3>
        {publicLists.length === 0 ? (
          <div className="dash-empty">Ingen synlige lister endnu. Opret en på Lister-siden og gør den synlig for teamet.</div>
        ) : (
          publicLists.map((l, i) => {
            const itemCount = l.companies.length + l.cvrCompanies.length;
            return (
              <div className="panel-card list-card-anim" style={{ marginTop: i === 0 ? 0 : 10, animationDelay: `${Math.min(i, 8) * 40}ms` }} key={l.id}>
                <div className="list-header-row" onClick={() => setSelectedListId(l.id)}>
                  <div className="list-header-title">
                    <h3 className="list-name-link">{l.name}</h3>
                    <span className="tag">
                      {itemCount} {itemCount === 1 ? "virksomhed" : "virksomheder"}
                    </span>
                  </div>
                </div>
                <div className="distance-note list-created-note">
                  {l.createdByName ? `Oprettet af ${l.createdByName} · ` : ""}
                  {formatDate(l.createdAt)}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="footer-note">Den første person i et team er automatisk ejer og kan gøre andre til admin herfra.</div>

      {/* Rendered before LeadDrawer/CvrDrawer so that opening a company from
          inside this list preview stacks visually on top of it — all three
          drawers share the same z-index, so later-in-DOM wins the tie. */}
      {selectedList ? (
        <TeamListDrawer
          list={selectedList}
          openableCvrNummers={openableCvrNummers}
          onClose={() => setSelectedListId(null)}
          onOpenCompany={(id) => setSelectedId(id)}
          onOpenCvrCompany={openCvrByNummer}
        />
      ) : null}

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
