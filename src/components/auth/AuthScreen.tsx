"use client";

import { useActionState, useState } from "react";
import { signIn as clientSignIn } from "next-auth/react";
import { LogoMark } from "@/components/shared/Logo";
import { signupAction, loginAction, forgotPasswordAction, type ActionResult } from "@/lib/actions/auth-actions";

type Tab = "signin" | "signup";
type View = "auth" | "reset";

const initialState: ActionResult = {};

export function AuthScreen({ joinCode, googleConfigured }: { joinCode: string | null; googleConfigured: boolean }) {
  const [tab, setTab] = useState<Tab>("signin");
  const [view, setView] = useState<View>("auth");
  const [resetSent, setResetSent] = useState(false);

  const [signinState, signinFormAction, signinPending] = useActionState(loginAction, initialState);
  const [signupState, signupFormAction, signupPending] = useActionState(signupAction, initialState);
  const [forgotState, forgotFormAction, forgotPending] = useActionState(
    async (_prev: ActionResult, formData: FormData) => {
      const result = await forgotPasswordAction(_prev, formData);
      if (result.ok) setResetSent(true);
      return result;
    },
    initialState
  );

  return (
    <div id="loginScreen">
      <div className="login-card">
        <div className="login-brand">
          <div className="sidebar-brand-mark" style={{ width: 52, height: 52 }}>
            <LogoMark size={40} />
          </div>
        </div>
        <h1>CLIRO</h1>
        <p className="sub">Jeres fælles arbejdsområde for leads — status, tildeling og aktivitet er delt med jeres team.</p>

        {view === "auth" ? (
          <>
            <div className="auth-tabs">
              <button type="button" className={tab === "signin" ? "active" : ""} onClick={() => setTab("signin")}>
                Log ind
              </button>
              <button type="button" className={tab === "signup" ? "active" : ""} onClick={() => setTab("signup")}>
                Opret konto
              </button>
            </div>

            {tab === "signin" ? (
              <form className="auth-form" action={signinFormAction}>
                {joinCode ? <input type="hidden" name="join" value={joinCode} /> : null}
                <label htmlFor="signinEmail">Email</label>
                <input id="signinEmail" name="email" type="email" className="field" placeholder="dig@firma.dk" autoComplete="email" style={{ marginBottom: 12 }} required />
                <label htmlFor="signinPassword">Adgangskode</label>
                <input id="signinPassword" name="password" type="password" className="field" placeholder="••••••••" autoComplete="current-password" style={{ marginBottom: 8 }} required />
                <div style={{ textAlign: "right", marginBottom: 14 }}>
                  <button type="button" className="link-btn" onClick={() => setView("reset")}>
                    Glemt adgangskode?
                  </button>
                </div>
                {signinState.error ? <p style={{ color: "var(--bad)", fontSize: 12.5, margin: "0 0 12px" }}>{signinState.error}</p> : null}
                <button type="submit" className="btn primary wide" disabled={signinPending}>
                  {signinPending ? "Logger ind…" : "Log ind"}
                </button>
              </form>
            ) : (
              <form className="auth-form" action={signupFormAction}>
                {joinCode ? <input type="hidden" name="join" value={joinCode} /> : null}
                <label htmlFor="signupName">Navn</label>
                <input id="signupName" name="name" type="text" className="field" placeholder="Fx Gustav" maxLength={60} autoComplete="name" style={{ marginBottom: 12 }} required />
                <label htmlFor="signupEmail">Email</label>
                <input id="signupEmail" name="email" type="email" className="field" placeholder="dig@firma.dk" autoComplete="email" style={{ marginBottom: 12 }} required />
                <label htmlFor="signupPassword">Adgangskode</label>
                <input id="signupPassword" name="password" type="password" className="field" placeholder="Mindst 4 tegn" autoComplete="new-password" style={{ marginBottom: 14 }} required />
                {signupState.error ? <p style={{ color: "var(--bad)", fontSize: 12.5, margin: "0 0 12px" }}>{signupState.error}</p> : null}
                <button type="submit" className="btn primary wide" disabled={signupPending}>
                  {signupPending ? "Opretter…" : "Opret konto"}
                </button>
              </form>
            )}

            <div id="authAltSection">
              <div className="login-divider">eller</div>
              <button
                type="button"
                className="google-btn"
                onClick={() => {
                  if (googleConfigured) {
                    clientSignIn("google", { callbackUrl: joinCode ? `/team-gate?join=${joinCode}` : "/" });
                  }
                }}
              >
                <GoogleIcon />
                Fortsæt med Google
              </button>
              {!googleConfigured ? (
                <div className="login-google-note show">
                  Google-login kræver en registreret OAuth-klient — det er ikke sat op endnu (se README). Brug email/adgangskode ovenfor i stedet.
                </div>
              ) : null}
            </div>
            <div className="login-note">
              Adgangskoder er rigtigt hashet og gemt i en rigtig database. Del adgang til jeres team via en invitationskode.
            </div>
          </>
        ) : (
          <form className="auth-form" action={forgotFormAction}>
            {resetSent ? (
              <>
                <div className="login-google-note show" style={{ marginBottom: 14 }}>
                  Hvis der findes en konto med den email, er der sendt en mail med et link til at nulstille adgangskoden. Linket udløber om 1 time.
                </div>
                <button
                  type="button"
                  className="btn wide"
                  onClick={() => {
                    setResetSent(false);
                    setView("auth");
                  }}
                >
                  Tilbage til log ind
                </button>
              </>
            ) : (
              <>
                <label htmlFor="forgotEmail">Email</label>
                <input id="forgotEmail" name="email" type="email" className="field" placeholder="dig@firma.dk" style={{ marginBottom: 10 }} required />
                <div className="login-google-note show" style={{ margin: "0 0 14px" }}>
                  Vi sender et link til at nulstille din adgangskode, hvis der findes en konto med den email.
                </div>
                {forgotState.error ? <p style={{ color: "var(--bad)", fontSize: 12.5, margin: "0 0 12px" }}>{forgotState.error}</p> : null}
                <button type="submit" className="btn primary wide" disabled={forgotPending}>
                  {forgotPending ? "Sender…" : "Send nulstillingslink"}
                </button>
                <button type="button" className="btn wide" style={{ marginTop: 8 }} onClick={() => setView("auth")}>
                  Tilbage til log ind
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" width="17" height="17">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.5 35.1 26.9 36 24 36c-5.3 0-9.6-3.3-11.3-8l-6.6 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-0.8 2.3-2.3 4.3-4.2 5.7l6.6 5.6C39.9 37 44 31 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}
