// Verbatim port of the handed-off financial-dashboard's server/src/lib/csv.ts.

// Minimal RFC4180-ish CSV parser: handles quoted fields, embedded delimiters/newlines, custom delimiter.
export function parseCsv(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      pushField();
    } else if (c === "\r") {
      // ignore, \n handles the row break
    } else if (c === "\n") {
      pushRow();
    } else {
      field += c;
    }
  }
  // last field/row if file doesn't end in newline
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

// Danish number format: "1.234,56 kr." -> 1234.56 ; "-91,75" -> -91.75 ; "" -> 0
export function parseDanishNumber(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw
    .replace(/kr\.?/gi, "")
    .replace(/[^\d,.-]/g, "")
    .trim();
  if (!cleaned) return 0;
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(normalized);
  return Number.isNaN(n) ? 0 : n;
}

// "28-08-2026" or "28/08/2026" -> "2026-08-28"
export function parseEuroDate(raw: string | undefined): string {
  if (!raw) return "";
  const m = raw.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (!m) return raw;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// "2026/08/28 11:47:03" -> "2026-08-28"
export function parseSlashDate(raw: string | undefined): string {
  if (!raw) return "";
  const datePart = raw.trim().split(" ")[0];
  const m = datePart.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return datePart;
  const [, y, mo, d] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export function simpleHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}
