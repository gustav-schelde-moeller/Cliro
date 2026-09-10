import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import type { Tier } from "@/lib/companies";

// Vercel Hobby caps Serverless Function duration at 300s — confirmed by a
// failed deploy at 800s ("Serverless Functions must have a maxDuration
// between 1 and 300 for plan hobby"). Since a single run can't be made
// longer, the daily target is instead split across several smaller runs
// per day (see .github/workflows/daily-research.yml) that each comfortably
// finish within this cap.
export const maxDuration = 300;

// Each run inserts at most 1 company (the first discovery candidate that
// verifies). .github/workflows/daily-research.yml schedules multiple runs
// per weekday so the daily total still reaches a reasonable volume.
//
// Live testing (see git log on this file) showed the real bottleneck isn't
// how much is asked for — it's that a single turn searching AND strictly
// verifying a candidate's publish date AND writing full research kept
// running past Vercel's 300s ceiling even for 1 company, regardless of
// max_uses or output size. Splitting into two focused phases fixes this:
// discovery is loose/fast (trust search snippets, find a few candidates),
// verification is narrow (check ONE already-identified source instead of
// searching broadly), so neither phase has to do everything at once.
const DISCOVERY_CANDIDATES = 3;
const DISCOVERY_MAX_USES = 4;
const VERIFY_MAX_USES = 4;

const TIER_LABELS: Record<Tier, string> = {
  hot: "Varm lead",
  warm: "God mulighed",
  cool: "Kan overvejes",
};

type Candidate = {
  name: string;
  website: string;
  hookTitle: string;
  hookUrl: string;
  hookDateGuess: string;
};

const SUBMIT_CANDIDATES_TOOL: Anthropic.Tool = {
  name: "submit_candidates",
  description: `Submit up to ${DISCOVERY_CANDIDATES} candidate Danish companies with a news story that LOOKS like it's from today or yesterday, based on search results. This is a fast first pass — do not deeply verify the publish date yet, that happens in a later step. It's fine to submit fewer than ${DISCOVERY_CANDIDATES}, or none, if nothing plausible turns up.`,
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      candidates: {
        type: "array",
        description: `0 to ${DISCOVERY_CANDIDATES} candidates.`,
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Official company name." },
            website: { type: "string", description: "Domain only, no protocol, e.g. example.dk" },
            hookTitle: { type: "string", description: "Short title of the news story." },
            hookUrl: { type: "string", description: "Direct source URL for the news." },
            hookDateGuess: { type: "string", description: "Danish-formatted date the source appears to be from, e.g. '23. marts 2026'." },
          },
          required: ["name", "website", "hookTitle", "hookUrl", "hookDateGuess"],
          additionalProperties: false,
        },
      },
    },
    required: ["candidates"],
    additionalProperties: false,
  },
};

const SUBMIT_COMPANIES_TOOL: Anthropic.Tool = {
  name: "submit_companies",
  description:
    "Submit the fully researched company if — and only if — you verified the source's publish date is genuinely today or yesterday. Call this once, as your last step. If verification fails (older date, or you can't confirm it), call this with an empty companies array instead of guessing.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      companies: {
        type: "array",
        description: "0 or 1 company. Strict-mode custom tools don't support minItems/maxItems, so this is enforced by instruction only.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Official company name." },
            website: { type: "string", description: "Domain only, no protocol, e.g. example.dk" },
            industry: { type: "string", description: "Short Danish industry label, e.g. 'Fødevarer', 'Mode & tøj'." },
            city: { type: "string", description: "Danish city of the company's HQ." },
            lat: { type: "number", description: "Approximate latitude of the city." },
            lng: { type: "number", description: "Approximate longitude of the city." },
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
            dateRank: { type: "integer", description: "YYYYMM of the news hook's date, e.g. 202603 for March 2026." },
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
              type: "object",
              description: "The real, sourced news story that makes this company worth reaching out to now.",
              properties: {
                title: { type: "string" },
                summary: { type: "string" },
                date: { type: "string", description: "Danish-formatted date, e.g. '23. marts 2026'." },
                url: { type: "string", description: "Direct source URL for the news." },
              },
              required: ["title", "summary", "date", "url"],
              additionalProperties: false,
            },
            existing: { type: "string", description: "Danish text on the company's existing marketing/creative history relevant to a video-production pitch." },
            social: { type: "string", description: "Danish text summarizing the company's social media presence." },
            idea: { type: "string", description: "Danish text pitching a concrete creative video/campaign idea DAVAI could make for them, tied to the news hook." },
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
              properties: {
                subject: { type: "string" },
                body: { type: "string" },
              },
              required: ["subject", "body"],
              additionalProperties: false,
            },
          },
          required: [
            "name",
            "website",
            "industry",
            "city",
            "lat",
            "lng",
            "breakdown",
            "dateRank",
            "tier",
            "hook",
            "existing",
            "social",
            "idea",
            "contact",
            "mail",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["companies"],
    additionalProperties: false,
  },
};

const COMPANY_EXAMPLE_JSON = `{
  "name": "Sunset Boulevard",
  "website": "sunset-boulevard.dk",
  "industry": "Fødevarer",
  "city": "Søborg",
  "lat": 55.7361,
  "lng": 12.4964,
  "breakdown": { "contact": 30, "news": 33, "industry": 20, "creative": 15 },
  "dateRank": 202603,
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

function buildDiscoverySystemPrompt(todayDa: string, yesterdayDa: string): string {
  return `Du finder KANDIDATER til danske virksomheder til DAVAI, et dansk produktionsselskab der laver reklamefilm og musikvideoer og bruger nyheder som anledning til at cold-calle virksomheder.

Dette er kun en hurtig, indledende research-fase — du skal IKKE bruge tid på at åbne og grundigt verificere hver kildes publiceringsdato endnu, det sker i et senere, separat trin. Stol på søgeresultaternes egne datoer/snippets for nu.

Brug web_search fokuseret og find op til ${DISCOVERY_CANDIDATES} danske virksomheder, der ser ud til at have en nyhedshistorie fra i dag (${todayDa}) eller i går (${yesterdayDa}). For hver kandidat skal du angive navn, hjemmeside, en kort overskrift på nyheden, en direkte kilde-URL, og hvilken dato du umiddelbart tror nyheden er fra.

Kriterier:
- Skal være et rigtigt dansk selskab (eller et internationalt selskab med markant dansk tilstedeværelse).
- Må IKKE allerede findes i listen over eksisterende virksomheder i brugerbeskeden.
- Bland gerne brancher.
- Det er helt fint at levere færre end ${DISCOVERY_CANDIDATES}, eller ingen, hvis intet virker friskt.

Kald submit_candidates når du er færdig, som dit sidste skridt.`;
}

function buildDiscoveryUserPrompt(existingNames: string[], todayDa: string, yesterdayDa: string): string {
  return [
    `Dagens dato er ${todayDa}. I går var ${yesterdayDa}.`,
    "",
    "Eksisterende virksomheder i databasen (find IKKE disse igen, søg efter helt nye):",
    existingNames.join(", "),
    "",
    `Find op til ${DISCOVERY_CANDIDATES} kandidat-virksomheder med en nyhedshistorie der ser ud til at være fra i dag eller i går, og kald submit_candidates.`,
  ].join("\n");
}

function buildVerifySystemPrompt(todayDa: string, yesterdayDa: string): string {
  return `Du verificerer og færdig-researcher ÉN bestemt virksomhedskandidat til DAVAI, et dansk produktionsselskab der laver reklamefilm og musikvideoer og bruger nyheder som anledning til at cold-calle virksomheder.

Din opgave, i rækkefølge:
1. Brug web_fetch på kilde-URL'en du får i brugerbeskeden og BEKRÆFT at publiceringsdatoen faktisk er i dag (${todayDa}) eller i går (${yesterdayDa}). Hvis den er ældre, eller du ikke kan bekræfte det, skal du kalde submit_companies med en TOM companies-liste — gæt eller fyld ALDRIG på med en ældre nyhed.
2. Hvis datoen bekræftes: forsøg at finde en navngiven, relevant kontaktperson (marketing/PR/kommunikation/CEO) med en kilde-URL eller LinkedIn-profil. Opfind ALDRIG navne, mailadresser eller nyheder. Hvis du ikke kan finde en navngiven kontakt, sæt contact.found=false og de øvrige contact-felter til null.
3. Udfyld resten af felterne (industri, by, koordinater, breakdown, "existing", "social", "idea", "mail") baseret på det, du kan finde om virksomheden.

Brug web_fetch og web_search fokuseret — du har et begrænset antal kald til at verificere datoen og finde en kontaktperson.

Scoring (breakdown, summer til score):
- contact (0-30): højere jo mere direkte/relevant kontaktperson du fandt (navngivet + direkte mail = højt).
- news (0-35): højere jo friskere og mere konkret/handlingsorienteret nyheden er.
- industry (0-20): højere for brancher der egner sig godt til videoproduktion (forbrugerbrands, oplevelser, mode, fødevarer, retail) end for meget tekniske B2B-brancher.
- creative (0-15): højere jo mere oplagt en kreativ videoidé nyheden giver anledning til.
dateRank er YYYYMM for hook.date. tier.key er "hot" for score ≥85, "warm" for 70-84, "cool" under 70 — sæt label til den tilsvarende danske tekst.

Tone i "mail"-feltet: kort, uformel, konkret — nævn nyheden, præsentér DAVAI i én sætning, foreslå en konkret idé, og bed om en uforpligtende snak. Skriv i du-form. Signér "[dit navn], DAVAI".

Eksempel på et fuldt, korrekt udfyldt element (brug dette KUN som stilistisk skabelon for felterne — kopiér ikke indholdet, og bemærk at eksemplets dato ikke er dagens dato):
${COMPANY_EXAMPLE_JSON}

Kald submit_companies med præcis 0 eller 1 virksomhed, som dit sidste skridt.`;
}

function buildVerifyUserPrompt(candidate: Candidate, existingNames: string[], todayDa: string, yesterdayDa: string): string {
  return [
    `Dagens dato er ${todayDa}. I går var ${yesterdayDa}.`,
    "",
    "Eksisterende virksomheder i databasen (afvis kandidaten hvis den allerede findes her):",
    existingNames.join(", "),
    "",
    "Kandidat at verificere og færdig-researche:",
    `Navn: ${candidate.name}`,
    `Hjemmeside: ${candidate.website}`,
    `Formodet nyhed: ${candidate.hookTitle}`,
    `Kilde-URL: ${candidate.hookUrl}`,
    `Formodet dato: ${candidate.hookDateGuess}`,
    "",
    "Bekræft datoen på selve kilden, find en kontaktperson, og kald submit_companies.",
  ].join("\n");
}

type SubmittedCompany = {
  name: string;
  website: string;
  industry: string;
  city: string;
  lat: number;
  lng: number;
  breakdown: { contact: number; news: number; industry: number; creative: number };
  dateRank: number;
  tier: { key: string; label: string };
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
    sourceUrl: string | null;
    profileUrl: string | null;
  };
  mail: { subject: string; body: string };
};

function isValidTier(key: string): key is Tier {
  return key === "hot" || key === "warm" || key === "cool";
}

type TurnDiagnostics = {
  iterations: number;
  lastStopReason: string | null;
  finalText: string | null;
};

type TurnResult<T> =
  | { kind: "success"; result: T; diagnostics: TurnDiagnostics }
  | { kind: "timedOut"; diagnostics: TurnDiagnostics }
  | { kind: "noResult"; diagnostics: TurnDiagnostics }
  | { kind: "errorResponse"; response: Response };

// Runs one Claude "turn" (which may itself span several pause_turn round
// trips) until it calls `toolName` or gives up. Shared by the discovery and
// verification phases so both get the same deadline handling and pause_turn
// plumbing without duplicating it.
async function runToolLoop<T>(
  client: Anthropic,
  opts: {
    system: string;
    initialMessage: string;
    tools: Anthropic.Messages.ToolUnion[];
    toolName: string;
    maxTokens: number;
    deadlineAt: number;
  },
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
      // AbortSignal, not the `timeout` request option — `timeout` only
      // bounds time-to-first-byte (it wraps fetch(), which resolves once
      // headers arrive), not how long a streamed response can keep sending
      // SSE events afterward, which is where nearly all the time actually
      // goes for a turn doing web searches.
      const stream = client.messages.stream(
        {
          model: "claude-sonnet-5",
          max_tokens: opts.maxTokens,
          system: opts.system,
          thinking: { type: "disabled" },
          tools: opts.tools,
          messages,
        },
        { signal: AbortSignal.timeout(remainingMs) },
      );
      response = await stream.finalMessage();
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        return { kind: "errorResponse", response: Response.json({ error: "Rate limited by Anthropic" }, { status: 429 }) };
      }
      if (error instanceof Anthropic.APIUserAbortError || error instanceof Anthropic.APIConnectionTimeoutError) {
        return { kind: "timedOut", diagnostics: diagnosticsFrom(iterations, lastResponse) };
      }
      if (error instanceof Anthropic.APIError) {
        return {
          kind: "errorResponse",
          response: Response.json({ error: `Anthropic API-fejl: ${error.message}` }, { status: 502 }),
        };
      }
      throw error;
    }

    lastResponse = response;

    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }

    if (response.stop_reason === "tool_use") {
      const toolUse = response.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === opts.toolName,
      );
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

export async function GET(request: Request) {
  try {
    return await run(request);
  } catch (error) {
    console.error("daily-research cron failed:", error);
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return Response.json({ error: `Uventet fejl: ${message}` }, { status: 500 });
  }
}

async function run(request: Request): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY er ikke sat" }, { status: 500 });
  }

  const now = new Date();
  const dateFormatter = new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Copenhagen",
  });
  const todayDa = dateFormatter.format(now);
  const yesterdayDa = dateFormatter.format(new Date(now.getTime() - 24 * 60 * 60 * 1000));

  const existing = await prisma.company.findMany({ select: { name: true } });
  const existingNames = existing.map((c) => c.name);
  const seenNames = new Set(existingNames.map((n) => n.trim().toLowerCase()));

  const client = new Anthropic();

  // Vercel Hobby hard-kills the whole function at 300s (maxDuration) with
  // an opaque FUNCTION_INVOCATION_TIMEOUT / 504 — no chance for our own
  // code to run or return diagnostics. Everything below stays inside this
  // soft deadline so we always return a clean response instead.
  const startedAt = Date.now();
  const overallDeadlineAt = startedAt + 260_000;
  const discoveryDeadlineAt = Math.min(overallDeadlineAt, startedAt + 100_000);

  const discovery = await runToolLoop<{ candidates: Candidate[] }>(client, {
    system: buildDiscoverySystemPrompt(todayDa, yesterdayDa),
    initialMessage: buildDiscoveryUserPrompt(existingNames, todayDa, yesterdayDa),
    // The `_20260209` "dynamic filtering" web_search variant runs its own
    // code_execution sandbox under the hood — each bash round trip it uses
    // costs 20-30+ seconds, which is what actually blew every earlier
    // attempt past Vercel's 300s ceiling (confirmed by comparing raw
    // stream events between the two tool versions — same task, 117s vs
    // 18.5s). The basic `_20250305` variant does plain search with no
    // hidden sandbox and is what makes this loose discovery pass fast.
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: DISCOVERY_MAX_USES }, SUBMIT_CANDIDATES_TOOL],
    toolName: "submit_candidates",
    maxTokens: 2000,
    deadlineAt: discoveryDeadlineAt,
  });

  if (discovery.kind === "errorResponse") return discovery.response;

  if (discovery.kind !== "success" || discovery.result.candidates.length === 0) {
    return Response.json(
      {
        error:
          discovery.kind === "timedOut"
            ? "Nåede blødt tidsloft under kandidat-søgning"
            : "Fandt ingen kandidat-virksomheder",
        phase: "discovery",
        diagnostics: discovery.diagnostics,
      },
      { status: 502 },
    );
  }

  const attempts: Array<{ candidate: string; diagnostics: TurnDiagnostics | null; outcome: string }> = [];

  for (const candidate of discovery.result.candidates.slice(0, DISCOVERY_CANDIDATES)) {
    if (Date.now() >= overallDeadlineAt) break;

    const key = candidate.name.trim().toLowerCase();
    if (seenNames.has(key)) {
      attempts.push({ candidate: candidate.name, diagnostics: null, outcome: "already-known" });
      continue;
    }

    const verify = await runToolLoop<{ companies: SubmittedCompany[] }>(client, {
      system: buildVerifySystemPrompt(todayDa, yesterdayDa),
      initialMessage: buildVerifyUserPrompt(candidate, existingNames, todayDa, yesterdayDa),
      // web_fetch can only fetch URLs already present in the conversation —
      // buildVerifyUserPrompt includes candidate.hookUrl as plain text, so
      // the model can fetch that exact page directly instead of searching
      // for it again. Same basic (non-dynamic-filtering) tool family as
      // discovery, for the same reason: no hidden code_execution sandbox.
      tools: [
        { type: "web_search_20250305", name: "web_search", max_uses: VERIFY_MAX_USES },
        { type: "web_fetch_20250910", name: "web_fetch", max_uses: 2 },
        SUBMIT_COMPANIES_TOOL,
      ],
      toolName: "submit_companies",
      maxTokens: 6000,
      deadlineAt: overallDeadlineAt,
    });

    if (verify.kind === "errorResponse") return verify.response;

    if (verify.kind !== "success" || verify.result.companies.length === 0) {
      attempts.push({ candidate: candidate.name, diagnostics: verify.diagnostics, outcome: verify.kind });
      continue;
    }

    const c = verify.result.companies[0];
    const cKey = c.name.trim().toLowerCase();
    if (seenNames.has(cKey) || !isValidTier(c.tier.key)) {
      attempts.push({ candidate: candidate.name, diagnostics: verify.diagnostics, outcome: "invalid" });
      continue;
    }

    const score = c.breakdown.contact + c.breakdown.news + c.breakdown.industry + c.breakdown.creative;
    await prisma.company.create({
      data: {
        name: c.name,
        website: c.website,
        industry: c.industry,
        city: c.city,
        lat: c.lat,
        lng: c.lng,
        score,
        breakdown: c.breakdown,
        dateRank: c.dateRank,
        tier: { key: c.tier.key, label: TIER_LABELS[c.tier.key] },
        hook: c.hook,
        existing: c.existing,
        social: c.social,
        idea: c.idea,
        contact: c.contact,
        mail: c.mail,
      },
    });

    return Response.json({ inserted: [c.name], attempts });
  }

  return Response.json(
    {
      error: "Ingen af kandidaterne kunne verificeres inden for tidsbudgettet",
      phase: "verify",
      candidates: discovery.result.candidates.map((c) => c.name),
      attempts,
    },
    { status: 502 },
  );
}
