import Anthropic from "@anthropic-ai/sdk";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveTeamId } from "@/lib/session-team";
import type { Tier } from "@/lib/companies";

// Railway is a persistent Node server, not a serverless function platform —
// there's no Vercel-style hard maxDuration forcing a two-phase discover-then-
// verify split here (see the daily-research cron for why that split exists).
// This is a single, user-triggered, already-known-company request, so one
// focused pass is enough; still capped at a wall-clock deadline so a stuck
// request can't hang the UI forever.
const DEADLINE_MS = 90_000;
const WEB_SEARCH_MAX_USES = 4;
const WEB_FETCH_MAX_USES = 2;

const TIER_LABELS: Record<Tier, string> = {
  hot: "Varm lead",
  warm: "God mulighed",
  cool: "Kan overvejes",
};

// Same worked example the cron uses, as a stylistic template for the model —
// verbatim, since it's already proven to produce well-shaped Danish output.
const ANALYSIS_EXAMPLE_JSON = `{
  "breakdown": { "contact": 30, "news": 33, "industry": 20, "creative": 15 },
  "tier": { "key": "hot", "label": "Varm lead" },
  "hook": {
    "title": "Ny burger med oksehjerte på menuen",
    "summary": "'Heart & Beef'-burgeren med 20% oksehjerte i bøffen blev lanceret 23. marts 2026 på alle 47 restauranter — endnu et skridt i kædens smagseksperimenter (tidligere bl.a. hampefrø og fermenterede grøntsager).",
    "date": "23. marts 2026",
    "url": "https://via.ritzau.dk/pressemeddelelse/14843785/ja-der-er-oksehjerte-i-og-det-smager-virkelig-godt"
  },
  "existing": "Kæden har erfaring med utraditionelle kampagner — bl.a. 'Smagsdirektør'-kampagnen (2022-23), hvor en midlertidig 'Chief Taste Officer' valgte ny burgersmag. Aktiv YouTube-kanal og TikTok-tilstedeværelse, men ingen dokumenteret stor filmproduktion siden.",
  "social": "Aktive på TikTok med både brand- og creator-indhold samt egen YouTube-kanal (@Sunset-boulevardDk). Ingen konkrete følgertal fundet.",
  "idea": "Kort, humoristisk socialt format ('Tør du smage?'): danskere på gaden gætter, hvad der er i burgeren, før de får sandheden — flere korte episoder til TikTok/Reels, i forlængelse af kædens eksisterende smagseksperiment-DNA.",
  "contact": {
    "found": true,
    "name": "Cathrine Florian Bang",
    "title": "Commercial Director",
    "email": "presse@sunset-boulevard.dk",
    "note": "Generel pressekontakt: Pia Tobberup, +45 61 76 42 34.",
    "sourceUrl": "https://sunset-boulevard.dk/presseside/",
    "profileUrl": "https://www.linkedin.com/in/cathrine-florian-bang/"
  },
  "mail": {
    "subject": "Tør du smage det, før du ved hvad det er?",
    "body": "Hej Cathrine\\n\\nVi faldt over jeres nye oksehjerte-burger og jeres genkendelige DNA med at turde eksperimentere med smagen – det er den slags historie, der er skabt til at blive udfordret på film.\\n\\nVi er DAVAI, og vi laver reklamefilm og musikvideoer. Konkret idé: et kort, sjovt socialt format, hvor vi udfordrer almindelige danskere på gaden til at gætte, hvad der er i burgeren, før de får sandheden at vide – i flere korte episoder til TikTok og Reels.\\n\\nHar du 20 minutter til en uforpligtende snak om idéen?\\n\\nBedste hilsner,\\n[dit navn], DAVAI"
  }
}`;

const ANALYZE_TOOL: Anthropic.Tool = {
  name: "submit_analysis",
  description:
    "Submit the completed analysis of this specific company. Call this once, as your last step. Set hook to null if you could not find a genuine, sourced news story about this company — never invent one.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      breakdown: {
        type: "object",
        description: "Score components. contact 0-30, news 0-35, industry 0-20, creative 0-15.",
        properties: {
          contact: { type: "integer" },
          news: { type: "integer" },
          industry: { type: "integer" },
          creative: { type: "integer" },
        },
        required: ["contact", "news", "industry", "creative"],
        additionalProperties: false,
      },
      tier: {
        type: "object",
        properties: {
          key: { type: "string", enum: ["hot", "warm", "cool"] },
          label: { type: "string", enum: ["Varm lead", "God mulighed", "Kan overvejes"] },
        },
        required: ["key", "label"],
        additionalProperties: false,
      },
      hook: {
        description: "The real, sourced news story that makes this company worth reaching out to now — or null if you found none.",
        anyOf: [
          {
            type: "object",
            properties: {
              title: { type: "string" },
              summary: { type: "string" },
              date: { type: "string", description: "Danish-formatted date, e.g. '23. marts 2026'." },
              url: { type: "string", description: "Direct source URL for the news." },
            },
            required: ["title", "summary", "date", "url"],
            additionalProperties: false,
          },
          { type: "null" },
        ],
      },
      existing: { type: "string", description: "Danish text on the company's existing marketing/creative history relevant to a video-production pitch." },
      social: { type: "string", description: "Danish text summarizing the company's social media presence." },
      idea: { type: "string", description: "Danish text pitching a concrete creative video/campaign idea DAVAI could make for them." },
      contact: {
        type: "object",
        properties: {
          found: { type: "boolean" },
          name: { anyOf: [{ type: "string" }, { type: "null" }] },
          title: { anyOf: [{ type: "string" }, { type: "null" }] },
          email: { anyOf: [{ type: "string" }, { type: "null" }] },
          note: { anyOf: [{ type: "string" }, { type: "null" }] },
          sourceUrl: { anyOf: [{ type: "string" }, { type: "null" }] },
          profileUrl: { anyOf: [{ type: "string" }, { type: "null" }] },
        },
        required: ["found", "name", "title", "email", "note", "sourceUrl", "profileUrl"],
        additionalProperties: false,
      },
      mail: {
        type: "object",
        description: "A short draft outreach email in Danish, in DAVAI's voice, signed '[dit navn], DAVAI'.",
        properties: { subject: { type: "string" }, body: { type: "string" } },
        required: ["subject", "body"],
        additionalProperties: false,
      },
    },
    required: ["breakdown", "tier", "hook", "existing", "social", "idea", "contact", "mail"],
    additionalProperties: false,
  },
};

type AnalysisResult = {
  breakdown: { contact: number; news: number; industry: number; creative: number };
  tier: { key: string; label: string };
  hook: { title: string; summary: string; date: string; url: string } | null;
  existing: string;
  social: string;
  idea: string;
  contact: {
    found: boolean;
    name: string | null;
    title: string | null;
    email: string | null;
    note: string | null;
    sourceUrl: string | null;
    profileUrl: string | null;
  };
  mail: { subject: string; body: string };
};

function isValidTier(key: string): key is Tier {
  return key === "hot" || key === "warm" || key === "cool";
}

function buildSystemPrompt(): string {
  return `Du researcher ÉN bestemt dansk virksomhed til DAVAI, et dansk produktionsselskab der laver reklamefilm og musikvideoer og bruger nyheder/anledninger til at cold-calle virksomheder.

Virksomhedens grunddata (navn, CVR-nummer, branche, adresse, regnskabstal) får du i brugerbeskeden — det behøver du ikke undersøge selv. Din opgave, i rækkefølge:
1. Brug web_search til at finde den nyeste ÆGTE, kildebelagte nyhed om netop denne virksomhed — det behøver IKKE være fra i dag eller i går, blot en reel historie du kan finde en direkte kilde-URL til. Find du intet troværdigt, sæt hook til null. Opfind ALDRIG en nyhed eller en URL.
2. Forsøg at finde en navngiven, relevant kontaktperson (marketing/PR/kommunikation/CEO/ejer) med en kilde-URL eller LinkedIn-profil. Opfind ALDRIG navne eller mailadresser. Hvis du ikke kan finde en navngiven kontakt, sæt contact.found=false og de øvrige contact-felter til null.
3. Udfyld "existing" (eksisterende marketing/reklamehistorik) og "social" (tilstedeværelse på sociale medier) baseret på det du kan finde.
4. Skriv "idea" — en konkret kreativ videoidé. Hvis du fandt en nyhed (hook), knyt idéen til den. Hvis ikke, byg idéen på virksomhedens branche og profil i stedet.
5. Skriv "mail" — et kort udkast til en cold-mail, i du-form, der nævner enten nyheden eller virksomhedens profil, præsenterer DAVAI i én sætning, foreslår idéen, og beder om en uforpligtende snak. Signér "[dit navn], DAVAI".

Brug web_search og web_fetch fokuseret — du har et begrænset antal kald.

Scoring (breakdown, summer til score):
- contact (0-30): højere jo mere direkte/relevant kontaktperson du fandt.
- news (0-35): højere jo friskere og mere konkret/handlingsorienteret nyheden er — 0 hvis hook er null.
- industry (0-20): højere for brancher der egner sig godt til videoproduktion (forbrugerbrands, oplevelser, mode, fødevarer, retail) end for meget tekniske B2B-brancher.
- creative (0-15): højere jo mere oplagt en kreativ videoidé virksomheden giver anledning til.
tier.key er "hot" for score ≥85, "warm" for 70-84, "cool" under 70 — sæt label til den tilsvarende danske tekst.

Eksempel på et fuldt, korrekt udfyldt svar (brug dette KUN som stilistisk skabelon for felterne — kopiér ikke indholdet, det er en anden virksomhed):
${ANALYSIS_EXAMPLE_JSON}

Kald submit_analysis som dit sidste skridt.`;
}

function buildUserPrompt(company: {
  navn: string | null;
  cvrNummer: string;
  brancheTekst: string | null;
  kommunenavn: string | null;
  postnummer: string | null;
  employees: number | null;
  koebekraftScore: number | null;
  egenkapital: number | null;
  driftsresultat: number | null;
  nettoresultat: number | null;
}): string {
  return [
    `Virksomhed at researche: ${company.navn ?? `CVR ${company.cvrNummer}`}`,
    `CVR-nummer: ${company.cvrNummer}`,
    company.brancheTekst ? `Branche: ${company.brancheTekst}` : null,
    company.kommunenavn ? `Kommune: ${company.kommunenavn}${company.postnummer ? ` (${company.postnummer})` : ""}` : null,
    company.employees != null ? `Ansatte: ${company.employees}` : null,
    company.koebekraftScore != null ? `Købekraft-score (0-100, økonomisk soliditet): ${company.koebekraftScore}` : null,
    company.egenkapital != null ? `Egenkapital: ${Math.round(company.egenkapital).toLocaleString("da-DK")} kr.` : null,
    company.driftsresultat != null ? `Driftsresultat: ${Math.round(company.driftsresultat).toLocaleString("da-DK")} kr.` : null,
    company.nettoresultat != null ? `Nettoresultat: ${Math.round(company.nettoresultat).toLocaleString("da-DK")} kr.` : null,
    "",
    "Research virksomheden og kald submit_analysis.",
  ]
    .filter(Boolean)
    .join("\n");
}

type TurnDiagnostics = { iterations: number; lastStopReason: string | null; finalText: string | null };
type TurnResult<T> =
  | { kind: "success"; result: T; diagnostics: TurnDiagnostics }
  | { kind: "timedOut"; diagnostics: TurnDiagnostics }
  | { kind: "noResult"; diagnostics: TurnDiagnostics }
  | { kind: "errorResponse"; response: Response };

// Deliberately NOT shared with src/app/api/cron/daily-research/route.ts's
// identical helper — that cron has a hard-won, explicitly-documented
// debugging history (months of timeout failures). Duplicating ~80 lines
// here avoids any risk of a change made for this new, less-proven route
// regressing that already-fragile-by-its-own-admission production path.
async function runToolLoop<T>(
  client: Anthropic,
  opts: { system: string; initialMessage: string; tools: Anthropic.Messages.ToolUnion[]; toolName: string; maxTokens: number; deadlineAt: number },
): Promise<TurnResult<T>> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: opts.initialMessage }];
  let lastResponse: Anthropic.Message | null = null;
  let iterations = 0;

  for (let i = 0; i < 30; i++) {
    const remainingMs = opts.deadlineAt - Date.now();
    if (remainingMs <= 0) {
      return { kind: "timedOut", diagnostics: diagnosticsFrom(iterations, lastResponse) };
    }
    iterations++;
    let response: Anthropic.Message;
    try {
      const stream = client.messages.stream(
        { model: "claude-sonnet-5", max_tokens: opts.maxTokens, system: opts.system, thinking: { type: "disabled" }, tools: opts.tools, messages },
        { signal: AbortSignal.timeout(remainingMs) },
      );
      response = await stream.finalMessage();
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        return { kind: "errorResponse", response: Response.json({ error: "Rate limited af Anthropic" }, { status: 429 }) };
      }
      if (error instanceof Anthropic.APIUserAbortError || error instanceof Anthropic.APIConnectionTimeoutError) {
        return { kind: "timedOut", diagnostics: diagnosticsFrom(iterations, lastResponse) };
      }
      if (error instanceof Anthropic.APIError) {
        return { kind: "errorResponse", response: Response.json({ error: `Anthropic API-fejl: ${error.message}` }, { status: 502 }) };
      }
      throw error;
    }

    lastResponse = response;

    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }

    if (response.stop_reason === "tool_use") {
      const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === opts.toolName);
      if (toolUse) {
        return { kind: "success", result: toolUse.input as T, diagnostics: diagnosticsFrom(iterations, lastResponse) };
      }
      messages.push({ role: "assistant", content: response.content });
      continue;
    }

    break;
  }

  return { kind: "noResult", diagnostics: diagnosticsFrom(iterations, lastResponse) };
}

function diagnosticsFrom(iterations: number, lastResponse: Anthropic.Message | null): TurnDiagnostics {
  const finalText =
    lastResponse?.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n") || null;
  return { iterations, lastStopReason: lastResponse?.stop_reason ?? null, finalText };
}

export async function POST(request: Request, { params }: { params: Promise<{ cvr: string }> }) {
  const { cvr: cvrNummer } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const teamId = await getActiveTeamId(session.user.id);
  if (!teamId) {
    return Response.json({ error: "No active team" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY er ikke sat" }, { status: 500 });
  }

  const company = await prisma.cvrCompany.findUnique({ where: { cvrNummer } });
  if (!company) {
    return Response.json({ error: "Ukendt virksomhed." }, { status: 404 });
  }

  const client = new Anthropic();
  const deadlineAt = Date.now() + DEADLINE_MS;

  const turn = await runToolLoop<AnalysisResult>(client, {
    system: buildSystemPrompt(),
    initialMessage: buildUserPrompt(company),
    tools: [
      { type: "web_search_20250305", name: "web_search", max_uses: WEB_SEARCH_MAX_USES },
      { type: "web_fetch_20250910", name: "web_fetch", max_uses: WEB_FETCH_MAX_USES },
      ANALYZE_TOOL,
    ],
    toolName: "submit_analysis",
    maxTokens: 5000,
    deadlineAt,
  });

  if (turn.kind === "errorResponse") return turn.response;
  if (turn.kind !== "success") {
    return Response.json(
      { error: turn.kind === "timedOut" ? "Nåede tidsloftet under research" : "Fik intet resultat fra AI'en", diagnostics: turn.diagnostics },
      { status: 502 },
    );
  }

  const r = turn.result;
  if (!isValidTier(r.tier.key)) {
    return Response.json({ error: "Ugyldigt tier fra AI'en", diagnostics: turn.diagnostics }, { status: 502 });
  }
  const score = r.breakdown.contact + r.breakdown.news + r.breakdown.industry + r.breakdown.creative;

  const analysis = await prisma.cvrAnalysis.upsert({
    where: { cvrNummer },
    create: {
      cvrNummer,
      score,
      breakdown: r.breakdown,
      tier: { key: r.tier.key, label: TIER_LABELS[r.tier.key] },
      hook: r.hook ?? undefined,
      existing: r.existing,
      social: r.social,
      idea: r.idea,
      contact: r.contact,
      mail: r.mail,
      analyzedBy: session.user.id,
    },
    update: {
      score,
      breakdown: r.breakdown,
      tier: { key: r.tier.key, label: TIER_LABELS[r.tier.key] },
      hook: r.hook ?? Prisma.DbNull,
      existing: r.existing,
      social: r.social,
      idea: r.idea,
      contact: r.contact,
      mail: r.mail,
      analyzedBy: session.user.id,
    },
  });

  await prisma.activityLog.create({
    data: {
      teamId,
      userId: session.user.id,
      who: session.user.name ?? "Ukendt",
      action: "analyserede med AI:",
      companyName: company.navn ?? `CVR ${cvrNummer}`,
    },
  });

  return Response.json(analysis);
}
