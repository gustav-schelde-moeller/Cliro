export const STATUS_DEFS = [
  { key: "new", label: "Ny" },
  { key: "contacted", label: "Kontaktet" },
  { key: "meeting", label: "Møde booket" },
  { key: "won", label: "Vundet" },
  { key: "lost", label: "Afvist" },
] as const;

export type StatusKey = (typeof STATUS_DEFS)[number]["key"];

export function statusLabel(key: string): string {
  return STATUS_DEFS.find((s) => s.key === key)?.label ?? "Ny";
}
