"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/shared/Avatar";
import { ThemeSegmented } from "./ThemeSegmented";
import { useToast, errorMessage } from "@/components/shared/ToastProvider";
import { updateNameAction, updateAvatarAction, changePasswordAction, deleteAccountAction } from "@/lib/actions/profile-actions";
import { logoutAction } from "@/lib/actions/auth-actions";

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Kunne ikke læse billedet."));
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Kunne ikke læse billedet."));
      img.onload = () => {
        const size = 160;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas ikke understøttet."));
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = String(ev.target?.result);
    };
    reader.readAsDataURL(file);
  });
}

export function ProfilView({
  name,
  email,
  avatarDataUrl,
  teamName,
  hasPassword,
}: {
  name: string;
  email: string;
  avatarDataUrl: string | null;
  teamName: string;
  hasPassword: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [nameValue, setNameValue] = useState(name);
  const [avatar, setAvatar] = useState(avatarDataUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordPending, startPasswordTransition] = useTransition();

  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deletePending, startDeleteTransition] = useTransition();

  function handleSaveName() {
    const trimmed = nameValue.trim();
    if (!trimmed) return;
    startTransition(async () => {
      try {
        await updateNameAction(trimmed);
        showToast("Navn opdateret.");
        router.refresh();
      } catch (err) {
        showToast(errorMessage(err, "Kunne ikke opdatere navnet."));
      }
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Vælg en billedfil.");
      return;
    }
    try {
      const dataUrl = await resizeImage(file);
      setAvatar(dataUrl);
      startTransition(async () => {
        try {
          await updateAvatarAction(dataUrl);
          showToast("Profilbillede opdateret.");
          router.refresh();
        } catch (err) {
          showToast(errorMessage(err, "Kunne ikke gemme profilbilledet."));
        }
      });
    } catch (err) {
      showToast(errorMessage(err, "Kunne ikke behandle billedet."));
    }
  }

  function handleChangePassword() {
    if (!newPassword) return;
    startPasswordTransition(async () => {
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
    <section>
      <div className="panel-card" style={{ maxWidth: 520 }}>
        <div className="profil-row">
          <div>
            <div className="label">Profilbillede</div>
            <div className="desc">Vises i stedet for initialer rundt i appen.</div>
          </div>
          <div className="avatar-upload-row">
            <Avatar name={nameValue} avatarDataUrl={avatar} size="lg" />
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
            <button type="button" className="btn" onClick={() => fileInputRef.current?.click()}>
              Upload
            </button>
          </div>
        </div>
        <div className="profil-row">
          <div>
            <div className="label">Navn</div>
            <div className="desc">Bruges til at mærke jeres fælles aktivitet.</div>
          </div>
          <div className="name-edit">
            <input type="text" className="field" maxLength={60} value={nameValue} onChange={(e) => setNameValue(e.target.value)} />
            <button type="button" className="btn" disabled={isPending} onClick={handleSaveName}>
              Gem
            </button>
          </div>
        </div>
        <div className="profil-row">
          <div>
            <div className="label">Email</div>
            <div className="desc">Bruges til login. Kan ikke ændres her.</div>
          </div>
          <div className="desc">{email}</div>
        </div>
        <div className="profil-row">
          <div>
            <div className="label">Team</div>
            <div className="desc">Dit nuværende team.</div>
          </div>
          <div className="desc">{teamName}</div>
        </div>
        <div className="profil-row">
          <div>
            <div className="label">Adgangskode</div>
            <div className="desc">{hasPassword ? "Skift din adgangskode." : "Du har endnu ikke en adgangskode — sæt en her."}</div>
          </div>
          <div className="password-edit">
            {hasPassword ? (
              <input
                type="password"
                className="field"
                placeholder="Nuværende"
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
            <button type="button" className="btn" disabled={passwordPending || !newPassword} onClick={handleChangePassword}>
              {passwordPending ? "Gemmer…" : "Skift"}
            </button>
          </div>
        </div>
        <div className="profil-row">
          <div>
            <div className="label">Udseende</div>
            <div className="desc">Lyst, mørkt eller følg systemets indstilling.</div>
          </div>
          <ThemeSegmented />
        </div>
        <div className="profil-row">
          <div>
            <div className="label">Log ud</div>
            <div className="desc">Rydder din session i denne browser (påvirker ikke teamets data).</div>
          </div>
          <button type="button" className="btn" onClick={() => logoutAction()}>
            Log ud
          </button>
        </div>
      </div>

      <div className="panel-card danger-zone" style={{ maxWidth: 520 }}>
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
    </section>
  );
}
