import type { ImportRowIssue, OrderAllocation } from '../types';
import { parseCsv } from './csv';

/**
 * Warehouse edition-allocation sheet parsing. Pure: CSV text in, allocation
 * rows and issues out. Matching rows to a release's orders happens in the
 * data layer.
 *
 * The sheet is a Google Sheets export and arrives messy by design:
 *   - validation/formula rows above the real header (`#REF!`, `Mismatches:`,
 *     `TRUE`, ...) — the parser scans for the header row instead of assuming
 *     row 1;
 *   - a blank leading column and trailing helper columns;
 *   - one row per print per order (multi-print releases repeat the order
 *     number);
 *   - framing columns empty for "Print Only" rows;
 *   - edition numbers that aren't numbers ("AP" for artist's proofs) — kept
 *     as text.
 */

export interface ParsedAllocationRow {
  /** As in the sheet, e.g. "#76415". */
  orderNumber: string;
  allocation: OrderAllocation;
  /** 1-based row in the file, for issue reporting. */
  row: number;
}

export interface AllocationParseResult {
  rows: ParsedAllocationRow[];
  issues: ImportRowIssue[];
  rowsParsed: number;
}

const HEADER_COLUMNS = {
  orderNumber: 'Order Number',
  printName: 'Print Name',
  fulfilment: 'Fulfilment',
  frameFinish: 'Frame Finish',
  glass: 'Glass',
  mountingType: 'Mounting Type',
  setSize: 'Set_Size',
  editionNumber: 'Edition No.',
} as const;

function cleanCell(cells: string[], idx: number | undefined): string {
  if (idx === undefined) return '';
  return (cells[idx] ?? '').trim();
}

export function parseEditionAllocationCsv(csvText: string): AllocationParseResult {
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    return { rows: [], issues: [{ row: 0, reason: 'File is empty' }], rowsParsed: 0 };
  }

  // Find the header row: the first row containing both "Order Number" and
  // "Edition No." — everything above it is spreadsheet clutter.
  let headerRowIdx = -1;
  const colIndex: Partial<Record<keyof typeof HEADER_COLUMNS, number>> = {};
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].map((c) => c.trim());
    if (cells.includes(HEADER_COLUMNS.orderNumber) && cells.includes(HEADER_COLUMNS.editionNumber)) {
      headerRowIdx = i;
      for (const [key, name] of Object.entries(HEADER_COLUMNS) as [
        keyof typeof HEADER_COLUMNS,
        string,
      ][]) {
        const idx = cells.indexOf(name);
        if (idx !== -1) colIndex[key] = idx;
      }
      break;
    }
  }
  if (headerRowIdx === -1) {
    return {
      rows: [],
      issues: [
        {
          row: 0,
          reason:
            'No header row with "Order Number" and "Edition No." found — is this the edition allocation sheet?',
        },
      ],
      rowsParsed: 0,
    };
  }

  const parsed: ParsedAllocationRow[] = [];
  const issues: ImportRowIssue[] = [];
  let rowsParsed = 0;

  rows.slice(headerRowIdx + 1).forEach((cells, i) => {
    const rowNum = headerRowIdx + 2 + i;
    const orderNumber = cleanCell(cells, colIndex.orderNumber);
    const printName = cleanCell(cells, colIndex.printName);
    const editionNumber = cleanCell(cells, colIndex.editionNumber);
    if (!orderNumber && !printName && !editionNumber) return; // blank spacer row
    rowsParsed += 1;
    if (!orderNumber) {
      issues.push({ row: rowNum, reason: 'Row has no order number' });
      return;
    }
    const fulfilment = cleanCell(cells, colIndex.fulfilment);
    const setSizeRaw = cleanCell(cells, colIndex.setSize);
    const setSize = /^\d+$/.test(setSizeRaw) ? Number.parseInt(setSizeRaw, 10) : null;
    parsed.push({
      orderNumber,
      row: rowNum,
      allocation: {
        printName,
        fulfilment,
        frameFinish: cleanCell(cells, colIndex.frameFinish) || null,
        glass: cleanCell(cells, colIndex.glass) || null,
        mountingType: cleanCell(cells, colIndex.mountingType) || null,
        setSize,
        editionNumber: editionNumber || null,
      },
    });
  });

  return { rows: parsed, issues, rowsParsed };
}

/** Normalised key for matching sheet order numbers to Shopify order names. */
export function allocationOrderKey(orderNumber: string): string {
  return orderNumber.trim().replace(/^#/, '').toLowerCase();
}

/** Compact one-line description of an allocation's physical spec. */
export function describeAllocationSpec(a: OrderAllocation): string {
  if (!a.fulfilment || /print only/i.test(a.fulfilment)) return a.fulfilment || '—';
  const parts = [a.frameFinish, a.glass, a.mountingType].filter(Boolean);
  return parts.length > 0 ? `${a.fulfilment} · ${parts.join(' · ')}` : a.fulfilment;
}
