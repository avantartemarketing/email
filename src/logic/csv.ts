/**
 * Minimal RFC 4180 CSV parser — handles quoted fields, escaped quotes,
 * embedded commas/newlines, and CRLF line endings. Shopify order exports are
 * well-formed CSV, but collector names and line-item titles routinely contain
 * commas and quotes, so naive `split(',')` is not an option.
 */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
    } else if (ch === '"') {
      inQuotes = true;
      i += 1;
    } else if (ch === ',') {
      pushField();
      i += 1;
    } else if (ch === '\r') {
      i += 1; // swallow; the \n (if any) ends the row
      if (text[i] !== '\n') pushRow();
    } else if (ch === '\n') {
      pushRow();
      i += 1;
    } else {
      field += ch;
      i += 1;
    }
  }
  // Flush a trailing row with no final newline.
  if (field.length > 0 || row.length > 0) pushRow();

  // Drop rows that are entirely empty (blank trailing lines).
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/**
 * Parse a CSV with a header row into objects keyed by header name.
 * Header names are trimmed; duplicate headers keep the first occurrence.
 */
export function parseCsvWithHeader(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    header.forEach((name, idx) => {
      if (name && !(name in obj)) obj[name] = cells[idx] ?? '';
    });
    return obj;
  });
}
