import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

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
  createdAt: string;
};

type CompanyRow = {
  id: number;
  name: string;
  website: string;
  industry: string;
  city: string;
  lat: number;
  lng: number;
  score: number;
  breakdown: Prisma.JsonValue;
  dateRank: number;
  tier: Prisma.JsonValue;
  hook: Prisma.JsonValue;
  existing: string;
  social: string;
  idea: string;
  contact: Prisma.JsonValue;
  mail: Prisma.JsonValue;
  createdAt: Date;
};

function rowToCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name,
    website: row.website,
    industry: row.industry,
    city: row.city,
    lat: row.lat,
    lng: row.lng,
    score: row.score,
    breakdown: row.breakdown as Company["breakdown"],
    dateRank: row.dateRank,
    tier: row.tier as Company["tier"],
    hook: row.hook as Company["hook"],
    existing: row.existing,
    social: row.social,
    idea: row.idea,
    contact: row.contact as Company["contact"],
    mail: row.mail as Company["mail"],
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getCompanies(): Promise<Company[]> {
  const rows = await prisma.company.findMany({ orderBy: { id: "asc" } });
  return rows.map(rowToCompany);
}

// Danish month names, for parsing hook.date strings like "23. marts 2026".
const DA_MONTHS: Record<string, number> = {
  januar: 0,
  februar: 1,
  marts: 2,
  april: 3,
  maj: 4,
  juni: 5,
  juli: 6,
  august: 7,
  september: 8,
  oktober: 9,
  november: 10,
  december: 11,
};

// hook.date is free text written by the research AI — usually a specific,
// past-tense date ("23. marts 2026") but sometimes a vague future
// description ("Åbner medio august 2026"). Only the former is safe to treat
// as "how old is this news"; anything else falls back to createdAt below.
function parseDanishDate(text: string): Date | null {
  const m = text.match(/(\d{1,2})\.\s*([a-zæøå]+)\s*(\d{4})/i);
  if (!m) return null;
  const month = DA_MONTHS[m[2].toLowerCase()];
  if (month === undefined) return null;
  return new Date(Number(m[3]), month, Number(m[1]));
}

const SCORE_HALF_LIFE_DAYS = 45;
const SCORE_DECAY_FLOOR = 15;

// A lead's score should reflect how good a reason it is to reach out TODAY —
// a hot news angle from 6 months ago isn't hot anymore, even if the
// research score was high when it was first found. Score decays with a
// ~45-day half-life toward a floor (never to 0 — the underlying
// company/industry fit is still worth something once the specific news
// trigger has gone stale), anchored to hook.date when it parses as a real
// date, or to createdAt (when the lead was found) otherwise. The original
// `score` field is left untouched as the historical research record.
export function displayScore(company: Pick<Company, "score" | "hook" | "createdAt">, now: Date = new Date()): number {
  const anchor = parseDanishDate(company.hook.date) ?? new Date(company.createdAt);
  const ageDays = Math.max(0, (now.getTime() - anchor.getTime()) / 86_400_000);
  const decay = Math.pow(0.5, ageDays / SCORE_HALF_LIFE_DAYS);
  const decayed = SCORE_DECAY_FLOOR + (company.score - SCORE_DECAY_FLOOR) * decay;
  return Math.round(Math.max(0, Math.min(100, decayed)));
}

export async function getCompanyById(id: number): Promise<Company | undefined> {
  const row = await prisma.company.findUnique({ where: { id } });
  return row ? rowToCompany(row) : undefined;
}

export function industriesOf(companies: Company[]): string[] {
  return Array.from(new Set(companies.map((c) => c.industry))).sort((a, b) => a.localeCompare(b, "da"));
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
