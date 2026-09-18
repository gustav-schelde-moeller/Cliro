// Shared branche (industry) grouping logic — verbatim port of the handed-off
// cvr-tool's branche.js. Used by both the CVR API routes (filters/labels)
// and would be used by a købekraft-recompute script if that's ever rerun.

// Explicit code-based group: real-estate/housing codes that share no common
// keyword but are all "the same thing" in everyday language.
const EJENDOM_KODER = new Set([
  "682040", "682030", "682020", "681100", "681000", "683210", "683110",
  "682010", "683120", "811000",
]);

export interface BrancheRule {
  label: string;
  test: RegExp;
}

// Broad, everyday-language buckets. Order matters — first match wins — so more
// specific categories (IT, byggeri, sundhed...) are listed before generic
// catch-alls (rådgivning, detailhandel, engroshandel, fremstilling). This
// deliberately favours fewer/bigger/simpler categories over taxonomic
// precision: it's meant to be skimmed at a glance, not audited.
const BRANCHE_RULES: BrancheRule[] = [
  { label: "Foreninger & Organisationer", test: /forening|organisation|sammenslutning|fagforening|religiøse institutioner|sygdomsbekæmpende|velgørende|politiske partier/i },
  { label: "Finans & Investering", test: /finansiel|investering for egen regning|formueforvaltning|forsikring/i },
  { label: "IT & Software", test: /computer|software|it-infrastruktur|it- og computer|databehandling|hosting|internettet|drift af portaler/i },
  { label: "Byggeri & Håndværk", test: /tømrer|snedker|murer|maler(aktiviteter|forretning)|vvs|el-installation|opførelse af bygninger|byggeprojekt|tagdækning|gulvbelægning|bygningsfærdiggørelse|byggepladsarbejde|anlæg af ledningsnet|nedrivning|byggeaktivitet|bygningsarbejde|bygningsinstallation|anlægsaktivitet|anlægsarbejde|landskabspleje|glarmester|stukkatør|skorstensfejning/i },
  { label: "Ingeniør & Teknisk rådgivning", test: /ingeniør|teknisk rådgivning/i },
  { label: "Arkitekt & Design", test: /arkitekt|design/i },
  { label: "Bogføring & Revision", test: /bogføring|revision|skatterådgivning/i },
  { label: "Jura & Advokat", test: /juridisk|advokat/i },
  { label: "Rådgivning & Konsulentydelser", test: /rådgivning|konsulent|liberale.*tjenesteydelser|forretningsserviceaktivitet/i },
  { label: "Restauranter & Caféer", test: /restaurant|café|cafeer|spisested|udskænkning|catering|madbod/i },
  { label: "Bilværksted & Autoreparation", test: /reparation.*motorkøretøj|autoreparation|karosseri|dækservice/i },
  { label: "Reparation & Vedligeholdelse", test: /reparation og vedligeholdelse/i },
  { label: "Administration & Kontorservice", test: /administrations- og kontorservice|kombinerede administrationsservice/i },
  { label: "Transport & Fragt", test: /transport|fragt|kurér|kureraktivitet|post-.*aktivitet/i },
  { label: "Detailhandel", test: /detailhandel/i },
  { label: "Engroshandel", test: /engroshandel/i },
  { label: "Rengøring", test: /rengøring/i },
  { label: "Skønhed & Velvære", test: /frisør|skønhed|hudpleje|dagspa|barber/i },
  { label: "Sundhed & Omsorg", test: /læge|tandlæge|fysioterapi|ergoterapi|psykolog|sygepleje|plejehjem|sundhedsvæsen|behandlingsform|dyrlæge|omsorg/i },
  { label: "Børnepasning", test: /børnehave|vuggestue|dagpleje|skolefritidsordning/i },
  { label: "Undervisning", test: /undervisning|grundskole|skole/i },
  { label: "Sport & Fritid", test: /sport|fitnesscenter|sportsanlæg|sportsklub/i },
  { label: "Film, Foto & Medier", test: /film|video|fotografi|medieindhold|udgivelse af bøger|indspilning af lydoptagelser/i },
  { label: "Kultur & Underholdning", test: /teater|koncert|kunstnerisk|scenekunst|forlystelse|museum|bibliotek/i },
  { label: "Reklame, PR & Marketing", test: /reklame|marketing|public relations/i },
  { label: "Landbrug, Skovbrug & Fiskeri", test: /dyrkning|landbrug|skovbrug|avl af|husdyravl|fiskeri|havbrug/i },
  { label: "Vikarbureau & Rekruttering", test: /vikarbureau|personaleformidling|rekruttering/i },
  { label: "Udlejning & Leasing af udstyr", test: /udlejning og leasing af/i },
  { label: "Energi & Forsyning", test: /elektricitet|vandforsyning|varmeforsyning|fjernvarme|energikilde/i },
  { label: "Rejser, Hoteller & Overnatning", test: /rejsearrangør|hotel|overnatningsfacilitet|ferieboliger/i },
  { label: "Forskning & Udvikling", test: /forskning og eksperimentel udvikling/i },
  { label: "Fremstilling & Produktion", test: /fremstilling af|maskinforarbejdning/i },
];

export interface BrancheGroup {
  label: string;
  kodes: string[];
}

// Turns a raw kode/tekst pair into its display grouping: { label, kodes }.
// Anything matching none of the named rules above falls into one "Andet" bucket
// rather than cluttering the list with hundreds of one-off bureaucratic entries —
// deliberately favouring a short, skimmable list over exhaustive categorisation.
export function brancheDisplayGroup(kode: string | null, tekst: string | null): BrancheGroup {
  if (kode && EJENDOM_KODER.has(kode)) return { label: "Ejendomme", kodes: [...EJENDOM_KODER] };
  if (tekst) {
    for (const rule of BRANCHE_RULES) {
      if (rule.test.test(tekst)) return { label: rule.label, kodes: kode ? [kode] : [] };
    }
  }
  return { label: "Andet", kodes: kode ? [kode] : [] };
}

// How much a given branche-group typically spends on professional film/video
// (reklamefilm, employer branding, produktvideoer) — used as a multiplier on
// the raw købekraft score. Groups not listed default to 1.0 (neutral).
const VIDEO_NEED_MULTIPLIER: Record<string, number> = {
  "Reklame, PR & Marketing": 1.3,
  "Film, Foto & Medier": 1.3,
  "IT & Software": 1.25,
  "Finans & Investering": 1.2,
  "Ejendomme": 1.15,
  "Rejser, Hoteller & Overnatning": 1.15,
  "Kultur & Underholdning": 1.15,
  "Detailhandel": 1.1,
  "Engroshandel": 1.1,
  "Sport & Fritid": 1.1,
  "Restauranter & Caféer": 1.05,
  "Vikarbureau & Rekruttering": 1.05,
  "Energi & Forsyning": 1.0,
  "Sundhed & Omsorg": 1.0,
  "Undervisning": 1.0,
  "Arkitekt & Design": 1.0,
  "Ingeniør & Teknisk rådgivning": 0.95,
  "Rådgivning & Konsulentydelser": 0.95,
  "Byggeri & Håndværk": 0.9,
  "Administration & Kontorservice": 0.85,
  "Fremstilling & Produktion": 0.85,
  "Transport & Fragt": 0.85,
  "Skønhed & Velvære": 0.85,
  "Forskning & Udvikling": 0.8,
  "Andet": 0.8,
  "Udlejning & Leasing af udstyr": 0.75,
  "Bilværksted & Autoreparation": 0.7,
  "Reparation & Vedligeholdelse": 0.7,
  "Landbrug, Skovbrug & Fiskeri": 0.7,
  "Bogføring & Revision": 0.65,
  "Jura & Advokat": 0.65,
  "Rengøring": 0.6,
  "Børnepasning": 0.6,
  "Foreninger & Organisationer": 0.6,
};

export function videoNeedMultiplier(label: string): number {
  return VIDEO_NEED_MULTIPLIER[label] ?? 1.0;
}
