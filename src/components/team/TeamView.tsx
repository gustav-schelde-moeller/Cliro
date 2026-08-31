"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/shared/Avatar";
import { useToast, errorMessage } from "@/components/shared/ToastProvider";
import { statusLabel } from "@/lib/status";
import { inviteEmailAction, removeMemberAction, setRoleAction, type ActionResult } from "@/lib/actions/team-actions";

type MemberLead = { id: number; name: string; industry: string; status: string };
type Member = {
  userId: string;
  name: string;
  email: string;
  avatarDataUrl: string | null;
  role: "admin" | "member";
  isOwner: boolean;
  stats: { total: number; won: number; meeting: number };
  leads: MemberLead[];
};
type ActivityItem = { id: string; ts: string; who: string; action: string; company: string | null };

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
  members,
  activity,
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
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const inviteFormRef = useRef<HTMLFormElement>(null);

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
                <span className="tag">{m.leads.length} tildelt</span>
              </div>
              {m.leads.length > 0 ? (
                <div className="member-leads">
                  {m.leads.map((l) => (
                    <div className="member-lead-row" key={l.id}>
                      <span className="status-pill" data-status={l.status}>
                        {statusLabel(l.status)}
                      </span>
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
      <div className="footer-note">Den første person i et team er automatisk ejer og kan gøre andre til admin herfra.</div>
    </section>
  );
}
