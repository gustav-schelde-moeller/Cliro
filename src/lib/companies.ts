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
