"use client";

import { useState, useTransition } from "react";
import { useToast, errorMessage } from "@/components/shared/ToastProvider";
import { changePasswordAction, deleteAccountAction } from "@/lib/actions/profile-actions";
import { leaveTeamAction, deleteTeamAction } from "@/lib/actions/team-actions";

type Section = "adgangskode" | "team" | "farezone";

const SECTIONS: { key: Section; label: string; desc: string }[] = [
  { key: "adgangskode", label: "Adgangskode", desc: "Skift din login-adgangskode" },
  { key: "team", label: "Team", desc: "Forlad eller slet dit nuværende team" },
  { key: "farezone", label: "Farezone", desc: "Slet din konto permanent" },
];

function AdgangskodeSection({ hasPassword }: { hasPassword: boolean }) {
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pending, startTransition] = useTransition();

  function handleChangePassword() {
    if (!newPassword) return;
    startTransition(async () => {
      try {
        await changePasswordAction(currentPassword, newPassword);
        showToast("Adgangskode ændret.");
        setCurrentPassword("");
        setNewPassword("");
      } catch (err) {
        showToast(errorMessage(err, "Kunne ikke ændre adgangskoden."));
      }
    });
  }

  return (
    <div className="panel-card" style={{ maxWidth: 480 }}>
      <h3>Adgangskode</h3>
      <div className="profil-row" style={{ borderBottom: "none", flexDirection: "column", alignItems: "stretch", gap: 10 }}>
        <div className="desc">{hasPassword ? "Indtast din nuværende og en ny adgangskode." : "Du har endnu ikke en adgangskode — sæt en her."}</div>
        {hasPassword ? (
          <input
            type="password"
            className="field"
            placeholder="Nuværende adgangskode"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        ) : null}
        <input
          type="password"
          className="field"
          placeholder="Ny adgangskode"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <button type="button" className="btn primary" disabled={pending || !newPassword} onClick={handleChangePassword}>
          {pending ? "Gemmer…" : "Skift adgangskode"}
        </button>
      </div>
    </div>
  );
}

function TeamSection({ teamId, teamName, isOwner }: { teamId: string; teamName: string; isOwner: boolean }) {
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleLeave() {
    startTransition(async () => {
      try {
        await leaveTeamAction(teamId);
      } catch (err) {
        showToast(errorMessage(err, "Kunne ikke forlade teamet."));
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteTeamAction(teamId);
      } catch (err) {
        showToast(errorMessage(err, "Kunne ikke slette teamet."));
      }
    });
  }

  return (
    <div className="panel-card danger-zone" style={{ maxWidth: 480 }}>
      <h3>Team</h3>
      <div className="profil-row" style={{ borderBottom: "none" }}>
        <div>
          <div className="label">{isOwner ? "Slet team" : "Forlad team"}</div>
          <div className="desc">
            {isOwner
              ? `Sletter "${teamName}" permanent for alle medlemmer, inklusiv al aktivitet og alle tildelinger.`
              : `Du forlader "${teamName}". Dine egne tildelinger frigives til teamet.`}
          </div>
        </div>
        {confirming ? (
          <div className="delete-confirm-row">
            <button type="button" className="btn" disabled={pending} onClick={() => setConfirming(false)}>
              Fortryd
            </button>
            <button type="button" className="btn danger" disabled={pending} onClick={isOwner ? handleDelete : handleLeave}>
              {pending ? "Arbejder…" : isOwner ? "Ja, slet teamet" : "Ja, forlad teamet"}
            </button>
          </div>
        ) : (
          <button type="button" className="btn danger" onClick={() => setConfirming(true)}>
            {isOwner ? "Slet team" : "Forlad team"}
          </button>
        )}
      </div>
    </div>
  );
}

function FarezoneSection() {
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteAccountAction();
      } catch (err) {
        showToast(errorMessage(err, "Kunne ikke slette kontoen."));
      }
    });
  }

  return (
    <div className="panel-card danger-zone" style={{ maxWidth: 480 }}>
      <h3>Farezone</h3>
      <div className="profil-row" style={{ borderBottom: "none" }}>
        <div>
          <div className="label">Slet konto</div>
          <div className="desc">
            Sletter din konto permanent. Teams du ejer alene bliver slettet — teams med andre medlemmer får en ny ejer automatisk.
          </div>
        </div>
        {confirming ? (
          <div className="delete-confirm-row">
            <button type="button" className="btn" disabled={pending} onClick={() => setConfirming(false)}>
              Fortryd
            </button>
            <button type="button" className="btn danger" disabled={pending} onClick={handleDelete}>
              {pending ? "Sletter…" : "Ja, slet permanent"}
            </button>
          </div>
        ) : (
          <button type="button" className="btn danger" onClick={() => setConfirming(true)}>
            Slet konto
          </button>
        )}
      </div>
    </div>
  );
}

export function IndstillingerView({
  hasPassword,
  teamId,
  teamName,
  isOwner,
}: {
  hasPassword: boolean;
  teamId: string;
  teamName: string;
  isOwner: boolean;
}) {
  const [section, setSection] = useState<Section>("adgangskode");

  return (
    <section className="settings-layout">
      <nav className="settings-nav">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`settings-nav-item${section === s.key ? " active" : ""}`}
            onClick={() => setSection(s.key)}
          >
            <span>{s.label}</span>
            <span className="settings-nav-desc">{s.desc}</span>
          </button>
        ))}
      </nav>
      <div className="settings-content">
        {section === "adgangskode" ? <AdgangskodeSection hasPassword={hasPassword} /> : null}
        {section === "team" ? <TeamSection teamId={teamId} teamName={teamName} isOwner={isOwner} /> : null}
        {section === "farezone" ? <FarezoneSection /> : null}
      </div>
    </section>
  );
}
