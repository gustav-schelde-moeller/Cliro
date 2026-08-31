"use client";

import { useActionState, useState } from "react";
import { LogoMark } from "@/components/shared/Logo";
import { logoutAction } from "@/lib/actions/auth-actions";
import { createTeamAction, joinTeamAction, type ActionResult } from "@/lib/actions/team-actions";

type Tab = "create" | "join";

const initialState: ActionResult = {};

export function TeamGateScreen({ prefillCode }: { prefillCode: string | null }) {
  const [tab, setTab] = useState<Tab>(prefillCode ? "join" : "create");
  const [createState, createFormAction, createPending] = useActionState(createTeamAction, initialState);
  const [joinState, joinFormAction, joinPending] = useActionState(joinTeamAction, initialState);

  return (
    <div id="teamGateScreen" style={{ display: "flex" }}>
      <div className="login-card">
        <div className="login-brand">
          <div className="sidebar-brand-mark" style={{ width: 52, height: 52 }}>
            <LogoMark size={40} />
          </div>
        </div>
        <h1 style={{ fontSize: 21 }}>Vælg team</h1>
        <p className="sub">Opret et nyt team, eller indtast en invitationskode for at joine et team, en kollega har oprettet.</p>

        <div className="auth-tabs">
          <button type="button" className={tab === "create" ? "active" : ""} onClick={() => setTab("create")}>
            Opret team
          </button>
          <button type="button" className={tab === "join" ? "active" : ""} onClick={() => setTab("join")}>
            Jeg har en kode
          </button>
        </div>

        {tab === "create" ? (
          <form className="auth-form" action={createFormAction}>
            <label htmlFor="createTeamName">Team-navn</label>
            <input id="createTeamName" name="name" type="text" className="field" placeholder="Fx Salgsteamet" maxLength={60} style={{ marginBottom: 14 }} required />
            {createState.error ? <p style={{ color: "var(--bad)", fontSize: 12.5, margin: "0 0 12px" }}>{createState.error}</p> : null}
            <button type="submit" className="btn primary wide" disabled={createPending}>
              {createPending ? "Opretter…" : "Opret team"}
            </button>
          </form>
        ) : (
          <form className="auth-form" action={joinFormAction}>
            <label htmlFor="joinTeamCode">Invitationskode</label>
            <input
              id="joinTeamCode"
              name="code"
              type="text"
              className="field"
              placeholder="Fx 7K2N9P"
              maxLength={12}
              defaultValue={prefillCode ?? ""}
              style={{ marginBottom: 14, textTransform: "uppercase" }}
              required
            />
            {joinState.error ? <p style={{ color: "var(--bad)", fontSize: 12.5, margin: "0 0 12px" }}>{joinState.error}</p> : null}
            <button type="submit" className="btn primary wide" disabled={joinPending}>
              {joinPending ? "Joiner…" : "Join team"}
            </button>
          </form>
        )}

        <div className="login-note">Enhver invitationskode virker, uanset hvilken computer du bruger — koden slås op i den rigtige database.</div>
        <button type="button" className="btn wide" style={{ marginTop: 14 }} onClick={() => logoutAction()}>
          Log ud
        </button>
      </div>
    </div>
  );
}
