import rawCompanies from "./companies-data.json";

export type Tier = "hot" | "warm" | "cool";

export type Company = {
  id: number;
  name: string;
  website: string;
  industry: string;
  city: string;
  lat: number;
  lng: number;
  score: number;
  breakdown: { contact: number; news: number; industry: number; creative: number };
  dateRank: number;
  tier: { key: Tier; label: string };
  hook: { title: string; summary: string; date: string; url: string };
  existing: string;
  social: string;
  idea: string;
  contact: {
    found: boolean;
    name: string | null;
    title: string | null;
    email: string | null;
    note: string | null;
    sourceUrl?: string | null;
    profileUrl?: string | null;
  };
  mail: { subject: string; body: string };
};

export const COMPANIES: Company[] = rawCompanies as Company[];

export const INDUSTRIES: string[] = Array.from(new Set(COMPANIES.map((c) => c.industry))).sort((a, b) =>
  a.localeCompare(b, "da")
);

export function companyById(id: number): Company | undefined {
  return COMPANIES.find((c) => c.id === id);
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
