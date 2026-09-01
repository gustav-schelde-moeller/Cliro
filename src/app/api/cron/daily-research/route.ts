import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import type { Tier } from "@/lib/companies";

// Vercel Cron requests can run long (web search + reasoning) — allow up to 5 minutes.
export const maxDuration = 300;

const TIER_LABELS: Record<Tier, string> = {
  hot: "Varm lead",
  warm: "God mulighed",
  cool: "Kan overvejes",
};

const SUBMIT_COMPANIES_TOOL: Anthropic.Tool = {
  name: "submit_companies",
  description:
    "Submit the final list of newly researched companies. Call this once, after you are done searching, with 1-3 companies that are not already in the existing-companies list.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      companies: {
        type: "array",
        minItems: 1,
        maxItems: 3,
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
                name: { type: ["string", "null"] },
                title: { type: ["string", "null"] },
                email: { type: ["string", "null"] },
                note: { type: ["string", "null"] },
                sourceUrl: { type: ["string", "null"] },
                profileUrl: { type: ["string", "null"] },
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

const SYSTEM_PROMPT = `Du research danske virksomheder til DAVAI, et dansk produktionsselskab der laver reklamefilm og musikvideoer og bruger nyheder som anledning til at kontakte virksomheder.

Din opgave: find 1-3 danske virksomheder med en ÆGTE, veldokumenteret nyhedshistorie fra de seneste ca. 14 dage (produktlancering, rekord, kampagne, ledelsesskifte, investering, prisvinding e.l.), og saml research om dem, som sælgere hos DAVAI kan bruge til at tage kontakt.

Brug web_search grundigt. Alt skal være ægte og efterprøveligt — find den faktiske nyhed med en rigtig kilde-URL, og forsøg at finde en navngiven, relevant kontaktperson (marketing/PR/kommunikation/CEO) med en kilde-URL eller LinkedIn-profil. Opfind ALDRIG navne, mailadresser eller nyheder. Hvis du ikke kan finde en navngiven kontakt, sæt contact.found=false og de øvrige contact-felter til null — gæt aldrig.

Kriterier for de virksomheder du vælger:
- Skal være et rigtigt dansk selskab (eller et internationalt selskab med markant dansk tilstedeværelse).
- Må IKKE allerede findes i listen over eksisterende virksomheder, du får i brugerbeskeden — tjek navnet grundigt (stavevarianter, danske vs. engelske navne osv.).
- Skal have en konkret, dagsaktuel nyhedskrog — ikke generel virksomhedsinfo.
- Bland gerne brancher og virksomhedsstørrelser over tid; undgå at researche samme branche som sidst, hvis du kan se mønstre i den eksisterende liste.

Scoring (breakdown, summer til score):
- contact (0-30): højere jo mere direkte/relevant kontaktperson du fandt (navngivet + direkte mail = højt).
- news (0-35): højere jo friskere og mere konkret/handlingsorienteret nyheden er.
- industry (0-20): højere for brancher der egner sig godt til videoproduktion (forbrugerbrands, oplevelser, mode, fødevarer, retail) end for meget tekniske B2B-brancher.
- creative (0-15): højere jo mere oplagt en kreativ videoidé nyheden giver anledning til.
dateRank er YYYYMM for hook.date. tier.key er "hot" for score ≥85, "warm" for 70-84, "cool" under 70 — sæt label til den tilsvarende danske tekst.

Tone i "mail"-feltet: kort, uformel, konkret — nævn nyheden, præsentér DAVAI i én sætning, foreslå en konkret idé, og bed om en uforpligtende snak. Skriv i du-form. Signér "[dit navn], DAVAI".

Eksempel på et fuldt, korrekt udfyldt element (brug dette som stilistisk skabelon, kopiér ikke indholdet):
{
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
}

Når du er færdig med at søge og har 1-3 solide, ægte kandidater, kald submit_companies med dem. Kald den kun én gang, som dit sidste skridt.`;

function buildUserPrompt(existingNames: string[]): string {
  return [
    "Eksisterende virksomheder i databasen (find IKKE disse igen, søg efter helt nye):",
    existingNames.join(", "),
    "",
    "Find 1-3 nye danske virksomheder med en ægte, dagsaktuel nyhedshistorie fra de seneste ca. 14 dage, og lever fuld research på dem via submit_companies.",
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

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY er ikke sat" }, { status: 500 });
  }

  const existing = await prisma.company.findMany({ select: { name: true } });
  const existingNames = existing.map((c) => c.name);
  const seenNames = new Set(existingNames.map((n) => n.trim().toLowerCase()));

  const client = new Anthropic();
  const tools: Anthropic.Messages.ToolUnion[] = [
    { type: "web_search_20260209", name: "web_search", max_uses: 20 },
    SUBMIT_COMPANIES_TOOL,
  ];
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: buildUserPrompt(existingNames) }];

  let submitted: { companies: SubmittedCompany[] } | null = null;

  for (let i = 0; i < 12 && !submitted; i++) {
    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: "claude-opus-5",
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        thinking: { type: "adaptive" },
        output_config: { effort: "high" },
        tools,
        messages,
      });
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        return Response.json({ error: "Rate limited by Anthropic" }, { status: 429 });
      }
      if (error instanceof Anthropic.APIError) {
        return Response.json({ error: `Anthropic API-fejl: ${error.message}` }, { status: 502 });
      }
      throw error;
    }

    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }

    if (response.stop_reason === "tool_use") {
      const toolUse = response.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "submit_companies",
      );
      if (toolUse) {
        submitted = toolUse.input as { companies: SubmittedCompany[] };
        break;
      }
      messages.push({ role: "assistant", content: response.content });
      continue;
    }

    break;
  }

  if (!submitted) {
    return Response.json({ error: "Claude leverede ikke et struktureret resultat" }, { status: 502 });
  }

  const inserted: string[] = [];
  const skipped: string[] = [];

  for (const c of submitted.companies) {
    const key = c.name.trim().toLowerCase();
    if (seenNames.has(key) || !isValidTier(c.tier.key)) {
      skipped.push(c.name);
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
    seenNames.add(key);
    inserted.push(c.name);
  }

  return Response.json({ inserted, skipped });
}
