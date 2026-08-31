"use client";

import { useActionState } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/shared/Logo";
import { resetPasswordAction, type ActionResult } from "@/lib/actions/auth-actions";

const initialState: ActionResult = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);

  return (
    <div id="loginScreen">
      <div className="login-card">
        <div className="login-brand">
          <div className="sidebar-brand-mark" style={{ width: 52, height: 52 }}>
            <LogoMark size={40} />
          </div>
        </div>
        <h1>CLIRO</h1>
        <p className="sub">Vælg en ny adgangskode.</p>

        {state.ok ? (
          <>
            <div className="login-google-note show" style={{ marginBottom: 14 }}>
              Din adgangskode er nulstillet. Du kan nu logge ind med den nye.
            </div>
            <Link href="/login" className="btn primary wide" style={{ textDecoration: "none" }}>
              Til login
            </Link>
          </>
        ) : !token ? (
          <div className="login-google-note show">Der mangler et gyldigt link. Bed om et nyt nulstillingslink fra login-siden.</div>
        ) : (
          <form className="auth-form" action={formAction}>
            <input type="hidden" name="token" value={token} />
            <label htmlFor="newPassword">Ny adgangskode</label>
            <input
              id="newPassword"
              name="password"
              type="password"
              className="field"
              placeholder="Mindst 4 tegn"
              autoComplete="new-password"
              style={{ marginBottom: 14 }}
              required
            />
            {state.error ? <p style={{ color: "var(--bad)", fontSize: 12.5, margin: "0 0 12px" }}>{state.error}</p> : null}
            <button type="submit" className="btn primary wide" disabled={pending}>
              {pending ? "Nulstiller…" : "Nulstil adgangskode"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
