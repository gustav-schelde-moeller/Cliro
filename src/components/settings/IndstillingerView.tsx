"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/shared/Modal";
import { ThemeSegmented } from "@/components/profile/ThemeSegmented";
import { useToast, errorMessage } from "@/components/shared/ToastProvider";
import { changePasswordAction, deleteAccountAction } from "@/lib/actions/profile-actions";
import { leaveTeamAction, deleteTeamAction } from "@/lib/actions/team-actions";

type Section = "konto" | "team" | "udseende";

const SECTIONS: { key: Section; label: string; desc: string }[] = [
  { key: "konto", label: "Konto", desc: "Adgangskode og slet konto" },
  { key: "team", label: "Team", desc: "Forlad eller slet dit nuværende team" },
  { key: "udseende", label: "Udseende", desc: "Lyst, mørkt eller system" },
];

function ChangePasswordModal({ hasPassword, onClose }: { hasPassword: boolean; onClose: () => void }) {
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
        onClose();
      } catch (err) {
        showToast(errorMessage(err, "Kunne ikke ændre adgangskoden."));
      }
    });
  }

  return (
    <Modal title="Skift adgangskode" onClose={onClose}>
      {hasPassword ? (
        <input
          type="password"
          className="field"
          placeholder="Nuværende adgangskode"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoFocus
        />
      ) : null}
      <input
        type="password"
        className="field"
        placeholder="Ny adgangskode"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />
      <button type="button" className="btn primary wide" disabled={pending || !newPassword} onClick={handleChangePassword}>
        {pending ? "Gemmer…" : "Skift adgangskode"}
      </button>
    </Modal>
  );
}

function KontoSection({ hasPassword }: { hasPassword: boolean }) {
  const { showToast } = useToast();
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deletePending, startDeleteTransition] = useTransition();

  function handleDeleteAccount() {
    startDeleteTransition(async () => {
      try {
        await deleteAccountAction();
      } catch (err) {
        showToast(errorMessage(err, "Kunne ikke slette kontoen."));
      }
    });
  }

  return (
    <>
      <div className="panel-card" style={{ maxWidth: 480, marginBottom: 16 }}>
        <h3>Konto</h3>
        <div className="profil-row">
          <div>
            <div className="label">Adgangskode</div>
            <div className="desc">{hasPassword ? "Skift din login-adgangskode." : "Du har endnu ikke en adgangskode."}</div>
          </div>
          <button type="button" className="btn" onClick={() => setPasswordModalOpen(true)}>
            Skift adgangskode
          </button>
        </div>
      </div>

      <div className="panel-card danger-zone" style={{ maxWidth: 480 }}>
        <div className="profil-row">
          <div>
            <div className="label">Slet konto</div>
            <div className="desc">
              Sletter din konto permanent. Teams du ejer alene bliver slettet — teams med andre medlemmer får en ny ejer automatisk.
            </div>
          </div>
          {deleteConfirming ? (
            <div className="delete-confirm-row">
              <button type="button" className="btn" disabled={deletePending} onClick={() => setDeleteConfirming(false)}>
                Fortryd
              </button>
              <button type="button" className="btn danger" disabled={deletePending} onClick={handleDeleteAccount}>
                {deletePending ? "Sletter…" : "Ja, slet permanent"}
              </button>
            </div>
          ) : (
            <button type="button" className="btn danger" onClick={() => setDeleteConfirming(true)}>
              Slet konto
            </button>
          )}
        </div>
      </div>

      {passwordModalOpen ? <ChangePasswordModal hasPassword={hasPassword} onClose={() => setPasswordModalOpen(false)} /> : null}
    </>
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

function UdseendeSection() {
  return (
    <div className="panel-card" style={{ maxWidth: 480 }}>
      <h3>Udseende</h3>
      <div className="profil-row" style={{ borderBottom: "none" }}>
        <div>
          <div className="label">Tema</div>
          <div className="desc">Lyst, mørkt eller følg systemets indstilling.</div>
        </div>
        <ThemeSegmented />
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
  const [section, setSection] = useState<Section>("konto");

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
        {section === "konto" ? <KontoSection hasPassword={hasPassword} /> : null}
        {section === "team" ? <TeamSection teamId={teamId} teamName={teamName} isOwner={isOwner} /> : null}
        {section === "udseende" ? <UdseendeSection /> : null}
      </div>
    </section>
  );
}
