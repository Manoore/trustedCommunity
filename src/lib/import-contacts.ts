import { normalizePhone } from "@/lib/phone";

/**
 * Parses pasted contacts. Handles vCard (what the Contacts app on a phone or Mac
 * exports) and simple CSV, because typing thirty contacts by hand is the single
 * biggest reason a list never gets started.
 *
 * Deliberately dependency-free and forgiving: anything unparseable is reported
 * back as a skipped row rather than failing the whole paste.
 */
export type ParsedContact = {
  name: string;
  phone: string;
  /** E.164, null when the number could not be understood. */
  e164: string | null;
  raw: string;
};

export type ParseResult = {
  contacts: ParsedContact[];
  skipped: string[];
};

function unfoldVCardLines(text: string): string[] {
  // vCard folds long lines by starting the continuation with a space or tab.
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (/^[ \t]/.test(line) && out.length) {
      out[out.length - 1] += line.trimStart();
    } else {
      out.push(line);
    }
  }
  return out;
}

function parseVCard(text: string): ParseResult {
  const contacts: ParsedContact[] = [];
  const skipped: string[] = [];

  const cards = text.split(/BEGIN:VCARD/i).slice(1);
  for (const card of cards) {
    const lines = unfoldVCardLines(card);
    let name = "";
    let phone = "";

    for (const line of lines) {
      const upper = line.toUpperCase();
      if (!name && upper.startsWith("FN")) {
        name = line.slice(line.indexOf(":") + 1).trim();
      } else if (!name && upper.startsWith("N:")) {
        // "Lastname;Firstname;;;" -> "Firstname Lastname"
        const parts = line.slice(2).split(";");
        name = [parts[1], parts[0]].filter(Boolean).join(" ").trim();
      }
      if (!phone && upper.startsWith("TEL")) {
        phone = line.slice(line.indexOf(":") + 1).trim();
      }
    }

    if (!name || !phone) {
      if (name || phone) skipped.push(name || phone);
      continue;
    }

    contacts.push({
      name,
      phone,
      e164: normalizePhone(phone)?.e164 ?? null,
      raw: `${name} ${phone}`,
    });
  }

  return { contacts, skipped };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === "," || char === "\t") && !inQuotes) {
      out.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  out.push(current.trim());
  return out;
}

/** A number written the way people write them: +1 937-555-0148, (937) 555 0148, 98480 12345. */
const PHONE_IN_TEXT = /(\+?\d[\d\s().-]{6,}\d)/;

/**
 * WhatsApp and message threads do not share a clean "Name, number" row. They
 * share "Mike's Plumbing\n+1 937-555-0148", or a sentence with a number in it.
 * This reshapes those into the row the rest of the parser understands, and
 * leaves anything that already looks like a row alone.
 */
function normaliseLines(text: string): string[] {
  const out: string[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const phoneOnly = /^\+?[\d\s().-]{7,}$/.test(line);
    const prev = out[out.length - 1];

    // "Name" on one line, "number" on the next.
    if (phoneOnly && prev && !PHONE_IN_TEXT.test(prev)) {
      out[out.length - 1] = `${prev}, ${line}`;
      continue;
    }

    // "Mike's Plumbing 937-555-0148" or "call Mike on 937 555 0148": split at the number.
    if (!line.includes(",") && !line.includes("\t")) {
      const match = PHONE_IN_TEXT.exec(line);
      if (match) {
        const name = line
          .replace(match[0], " ")
          .replace(/\b(call|phone|number|tel|contact|is|on|at|-|:)\b/gi, " ")
          .replace(/[^\p{L}\p{N}'&.\s]/gu, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (name) {
          out.push(`${name}, ${match[0].trim()}`);
          continue;
        }
      }
    }

    out.push(line);
  }

  return out;
}

function parseDelimited(text: string): ParseResult {
  const contacts: ParsedContact[] = [];
  const skipped: string[] = [];

  for (const line of normaliseLines(text)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const cells = splitCsvLine(trimmed);
    // Skip an obvious header row.
    if (
      cells.length >= 2 &&
      /^(name|full ?name|contact)$/i.test(cells[0]) &&
      /phone|number|tel/i.test(cells[1])
    ) {
      continue;
    }

    if (cells.length < 2) {
      skipped.push(trimmed);
      continue;
    }

    const [name, phone] = cells;
    if (!name || !phone) {
      skipped.push(trimmed);
      continue;
    }

    contacts.push({
      name,
      phone,
      e164: normalizePhone(phone)?.e164 ?? null,
      raw: trimmed,
    });
  }

  return { contacts, skipped };
}

export function parseContacts(text: string): ParseResult {
  if (!text.trim()) return { contacts: [], skipped: [] };

  const result = /BEGIN:VCARD/i.test(text)
    ? parseVCard(text)
    : parseDelimited(text);

  // Collapse duplicates inside one paste, so the same number is not attempted twice.
  const seen = new Set<string>();
  const contacts = result.contacts.filter((c) => {
    const key = c.e164 ?? c.raw.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { contacts, skipped: result.skipped };
}
