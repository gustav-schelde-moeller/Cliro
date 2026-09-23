export function OwnerLockNote({ ownerName }: { ownerName: string }) {
  return (
    <div className="owner-lock-note">
      <svg viewBox="0 0 24 24" fill="none" width={13} height={13} aria-hidden>
        <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 11V8a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      Tildelt {ownerName} — kun {ownerName} eller en admin kan ændre status og opfølgning.
    </div>
  );
}
