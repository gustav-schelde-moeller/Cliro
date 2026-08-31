import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Resend's shared test sender — works with zero setup, but only delivers to
// the email address on the Resend account itself. Once you verify your own
// domain (see README), set EMAIL_FROM to something like "Cliro <team@yourdomain.com>".
const FROM = process.env.EMAIL_FROM || "Cliro <onboarding@resend.dev>";

export async function sendEmail(opts: { to: string; subject: string; html: string; text: string }) {
  if (!resend) {
    // No RESEND_API_KEY configured — don't crash the app (e.g. local dev
    // without email set up yet). Log so it's obvious in the server console.
    console.warn(`[email] RESEND_API_KEY not set — would have sent to ${opts.to}: "${opts.subject}"`);
    return { sent: false as const, reason: "not_configured" as const };
  }
  const { error } = await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
  if (error) {
    console.error("[email] send failed:", error);
    return { sent: false as const, reason: "send_error" as const, message: error.message };
  }
  return { sent: true as const };
}

export function inviteEmail(opts: { inviterName: string; teamName: string; code: string; joinUrl: string }) {
  const { inviterName, teamName, code, joinUrl } = opts;
  return {
    subject: `${inviterName} har inviteret dig til ${teamName} på Cliro`,
    text: `Hej\n\n${inviterName} har inviteret dig til at være med i teamet "${teamName}" på Cliro.\n\nKlik for at joine: ${joinUrl}\n\nEller indtast koden manuelt, når du er logget ind: ${code}\n\nVi ses,\n${inviterName}`,
    html: `
      <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;">
        <p>Hej</p>
        <p><b>${escapeHtml(inviterName)}</b> har inviteret dig til at være med i teamet <b>${escapeHtml(teamName)}</b> på Cliro.</p>
        <p style="margin:24px 0;">
          <a href="${joinUrl}" style="background:#2F55FC;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;">Join teamet</a>
        </p>
        <p style="color:#666;font-size:13px;">Eller indtast koden manuelt, når du er logget ind: <b>${escapeHtml(code)}</b></p>
        <p>Vi ses,<br/>${escapeHtml(inviterName)}</p>
      </div>
    `,
  };
}

export function resetPasswordEmail(opts: { name: string; resetUrl: string }) {
  const { name, resetUrl } = opts;
  return {
    subject: "Nulstil din adgangskode til Cliro",
    text: `Hej ${name}\n\nDu (eller nogen med adgang til din email) har bedt om at nulstille din adgangskode på Cliro.\n\nKlik her for at vælge en ny adgangskode (linket udløber om 1 time): ${resetUrl}\n\nHvis du ikke har bedt om dette, kan du roligt ignorere denne mail.`,
    html: `
      <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;">
        <p>Hej ${escapeHtml(name)}</p>
        <p>Du (eller nogen med adgang til din email) har bedt om at nulstille din adgangskode på Cliro.</p>
        <p style="margin:24px 0;">
          <a href="${resetUrl}" style="background:#2F55FC;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;">Vælg ny adgangskode</a>
        </p>
        <p style="color:#666;font-size:13px;">Linket udløber om 1 time. Hvis du ikke har bedt om dette, kan du roligt ignorere denne mail.</p>
      </div>
    `,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}
