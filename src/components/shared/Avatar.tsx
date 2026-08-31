function initials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  let s = parts[0]?.[0] || "?";
  if (parts.length > 1) s += parts[parts.length - 1][0];
  return s.toUpperCase();
}

export function Avatar({
  name,
  avatarDataUrl,
  size = "md",
}: {
  name: string;
  avatarDataUrl?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const className = size === "sm" ? "avatar sm" : size === "lg" ? "avatar lg" : "avatar";
  if (avatarDataUrl) {
    return (
      <div className={className}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarDataUrl} alt="" />
      </div>
    );
  }
  return <div className={className}>{initials(name)}</div>;
}
