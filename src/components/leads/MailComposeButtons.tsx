"use client";

// Opens the drafted mail in a real mail client, prefilled — Gmail's web
// compose, or whatever the system's default mail app is (Outlook, Apple
// Mail). onOpen fires on the click itself, since there's no way to know
// whether the mail was actually sent afterwards.
export function MailComposeButtons({
  to,
  subject,
  body,
  onOpen,
}: {
  to: string | null;
  subject: string;
  body: string;
  onOpen: () => void;
}) {
  const s = encodeURIComponent(subject);
  const b = encodeURIComponent(body);
  const gmailHref = `https://mail.google.com/mail/?view=cm&fs=1${to ? `&to=${encodeURIComponent(to)}` : ""}&su=${s}&body=${b}`;
  const mailtoHref = `mailto:${to ?? ""}?subject=${s}&body=${b}`;

  return (
    <>
      <a className="btn primary" href={gmailHref} target="_blank" rel="noopener noreferrer" onClick={onOpen}>
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M3.5 6.5 12 13l8.5-6.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
        Åbn i Gmail
      </a>
      <a className="btn" href={mailtoHref} onClick={onOpen}>
        Åbn i mailprogram
      </a>
    </>
  );
}
