import { useEffect, useId, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { ParseFault, ProductKind } from '../types';
import type { ParsedLineItem, ParseResult } from '../logic/importer';
import { parseShopifyOrderExport } from '../logic/importer';
import { productsInFile } from '../logic/intake';
import type { FileProduct } from '../logic/intake';
import { useApp } from '../ui/AppContext';
import { Bar, Dialog, Foot, Tag } from '../ui/rd';
import Field from '../rd/components/Field';
import Tick from '../rd/components/Tick';

/**
 * Read a Shopify order export, then decide what it is.
 *
 * The owner, 30 Aug 2026, on adding a release: *"in the short term it will be
 * a CSV download from Shopify per release of all the Orders."* Both doors that
 * take one — creating a release and adding orders to an existing one — are
 * this dialogue with a different second pane, so the file half is written once.
 *
 * ## Two panes, and why the position is in the title
 *
 * The second pane cannot be drawn until the file has been read: it lists the
 * products the file actually contains. So this is genuinely two steps, and it
 * says so the cheapest honest way — the title gains the file name, and the way
 * back reads **Back**. There is no stepper: the kit has no staged-flow
 * vocabulary and inventing a rail for two panes would be inventing one.
 *
 * ## The drop target takes its own drops
 *
 * The kit's `.rd-importdrop` is a `<label>` around `<input type="file"
 * accept=".csv">`, and the INPUT is the drop target — so a browser validates
 * `accept` on drop and swallows a non-matching file without firing `change`.
 * Drop the `.xlsx` an operator actually has on disk and nothing happens at
 * all: no name, no band, no toast, and a shut primary whose reason is not the
 * reason. The label handles `onDrop` itself and judges the file on its
 * contents, so a wrong file gets an answer.
 */
export function OrderIntakeDialog({
  open,
  title,
  onClose,
  onRead,
  children,
  primary,
  secondary,
  parse,
}: {
  open: boolean;
  /** The dialogue's name, before the file. "New release", "Add orders — X". */
  title: string;
  onClose: () => void;
  /** Called once a file reads cleanly; the caller owns pane two. */
  onRead: (result: ParseResult, products: FileProduct[], fileName: string) => void;
  /** Pane two, drawn by the caller. Null until a file has been read. */
  children: ReactNode | null;
  primary?: { label: string; onClick: () => void; disabled?: boolean; why?: string };
  secondary?: { label: string; onClick: () => void };
  /** The current parse, so Back can clear it. */
  parse: { fileName: string } | null;
}): ReactElement {
  const { showToast } = useApp();
  const pasteId = useId();
  const [pasted, setPasted] = useState('');
  const [fault, setFault] = useState<ParseFault | null>(null);
  const [reading, setReading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csv, setCsv] = useState('');

  useEffect(() => {
    if (open) return;
    setPasted('');
    setFault(null);
    setFileName(null);
    setCsv('');
  }, [open]);

  const take = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    setFileName(file.name);
    setFault(null);
    try {
      setCsv(await file.text());
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    }
  };

  const read = (): void => {
    const text = csv || pasted;
    if (!text.trim()) return;
    setReading(true);
    try {
      const result = parseShopifyOrderExport(text);
      if (result.fault) {
        setFault(result.fault);
        return;
      }
      setFault(null);
      onRead(result, productsInFile(result.items), fileName ?? 'pasted export');
    } finally {
      setReading(false);
    }
  };

  const onPaneTwo = parse !== null;

  return (
    <Dialog
      open={open}
      size="lg"
      onClose={onClose}
      title={onPaneTwo ? `${title} — ${parse.fileName}` : title}
      primary={
        onPaneTwo
          ? primary
          : {
              label: 'Read the file',
              onClick: read,
              disabled: reading || !(csv || pasted).trim(),
            }
      }
      secondary={onPaneTwo ? secondary : { label: 'Cancel', onClick: onClose }}
    >
      {onPaneTwo ? (
        children
      ) : (
        <>
          {fault ? <FaultBar fault={fault} /> : null}
          {/* `onDrop` on the LABEL, not left to the input — see the note above. */}
          <label
            className="rd-importdrop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void take(e.dataTransfer.files[0]);
            }}
          >
            {fileName ? `Replace ${fileName}` : 'Choose the Shopify order export, or drop it here'}
            <input type="file" onChange={(e) => void take(e.target.files?.[0])} />
          </label>
          {csv ? null : (
            <div className="rd-fields">
              <Field
                label="Or paste the export"
                value={pasted}
                onChange={setPasted}
                controlId={pasteId}
                multiline
                deep
              />
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}

/**
 * What is wrong with the FILE — never a row count.
 *
 * The two used to share a channel, so an empty file drew "1 row could not be
 * read" over the body "Everything else was imported." Each of these is said
 * only where it is true, and the column case names the columns FOUND, because
 * that is what identifies the file somebody dropped by mistake.
 */
function FaultBar({ fault }: { fault: ParseFault }): ReactElement {
  const title =
    fault.kind === 'empty'
      ? 'That file is empty'
      : fault.kind === 'wrong_separator'
        ? 'This file is not comma-separated'
        : fault.kind === 'no_rows'
          ? 'That export has no orders in it'
          : 'That is not a Shopify order export';
  return (
    <Bar tone="fail" title={title}>
      {fault.detail}
      {fault.columnsFound && fault.columnsFound.length > 0 ? (
        <div className="rd-barby">Columns found: {fault.columnsFound.slice(0, 6).join(', ')}</div>
      ) : null}
    </Bar>
  );
}

/**
 * The products a file contains, and which of them are this release.
 *
 * A bare table rather than `DataTable`: the ruling that "DataTable is the one
 * table this app draws" is about WORKLISTS — a screen declaring its columns
 * once and getting search, Columns, Group, Sort and a remembered view.
 * `ImportIssues` already carved out the exception for a report inside a
 * dialogue, which has no view to remember and no filters to add; this is that
 * exception with a decision in it.
 *
 * The tick is a plain box and not the kit's `RowTick`: that one is the
 * SELECTION vocabulary, and ruling 9 pairs a live selection with a bulk bar
 * that replaces the header row. This table opens with rows already ticked, so
 * it would sit in a permanently live selection with no bulk bar. A tick here
 * means "include", which is a value, like a switch.
 */
export function FileProductsTable({
  products,
  ticked,
  onToggle,
  newByTitle,
  fulfilmentTagOf,
  foot,
}: {
  products: FileProduct[];
  ticked: Set<string>;
  onToggle: (lineItemTitle: string) => void;
  /** Add-orders only: how many of each row are not here yet. */
  newByTitle?: Map<string, number>;
  /**
   * What the ticked rows come to, from the caller's plan.
   *
   * Not computed here from `lines`: a row's line count is not the number of
   * orders that get created — a repeat inside the file is skipped — and this
   * table saying "126 orders" over a button saying "add 125" is exactly the
   * count-guessing this screen exists to end. Measured on Night Garden.
   */
  foot: string;
  /** Null for a sculpture, where the batch column says nothing. */
  fulfilmentTagOf: ((p: FileProduct) => ReactElement | null) | null;
}): ReactElement {
  const [filter, setFilter] = useState('');
  const filterId = useId();
  /* A Shopify "All orders" export — the DEFAULT export path — runs to hundreds
     of distinct line-item names. Uncapped, that is hundreds of 34px rows in a
     760px dialogue with the foot and the primary pushed off the bottom. */
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const matching = q
      ? products.filter((p) => p.lineItemTitle.toLowerCase().includes(q))
      : products;
    return { rows: matching.slice(0, 12), total: matching.length };
  }, [products, filter]);

  const tickedRows = products.filter((p) => ticked.has(p.lineItemTitle));

  return (
    <>
      {products.length > 12 ? (
        <div className="rd-fields">
          <Field label="Filter products" value={filter} onChange={setFilter} controlId={filterId} />
        </div>
      ) : null}
      <table className="rd-t rd-t27 rd-fit rd-importlist">
        <thead>
          <tr>
            <th scope="col" aria-hidden />
            <th scope="col">Product</th>
            <th scope="col">Variant</th>
            <th scope="col" className="n">
              {newByTitle ? 'In file' : 'Shopify orders'}
            </th>
            {newByTitle ? (
              <th scope="col" className="n">
                New
              </th>
            ) : null}
            {fulfilmentTagOf ? <th scope="col">Batch</th> : null}
          </tr>
        </thead>
        <tbody>
          {shown.rows.map((p) => {
            const on = ticked.has(p.lineItemTitle);
            return (
              <tr key={p.lineItemTitle}>
                <td>
                  {/* The kit's checkbox LOOK, without `RowTick`'s selection
                      gesture: this tick means "include", which is a value
                      like a switch, and ruling 9 pairs a live selection with
                      a bulk bar this table would never have. */}
                  <span
                    role="checkbox"
                    aria-checked={on}
                    aria-label={p.lineItemTitle}
                    tabIndex={0}
                    className={on ? 'rd-cbx on' : 'rd-cbx'}
                    onClick={() => onToggle(p.lineItemTitle)}
                    onKeyDown={(e) => {
                      if (e.key !== ' ') return;
                      e.preventDefault();
                      onToggle(p.lineItemTitle);
                    }}
                  >
                    <Tick />
                  </span>
                </td>
                <td className="rd-ink">{p.product}</td>
                <td>{p.variant || <span className="rd-none">—</span>}</td>
                <td className="n">{p.shopifyOrders}</td>
                {newByTitle ? <td className="n">{newByTitle.get(p.lineItemTitle) ?? 0}</td> : null}
                {fulfilmentTagOf ? (
                  <td>{on ? fulfilmentTagOf(p) : <span className="rd-none">–</span>}</td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
      <Foot>
        {shown.total > shown.rows.length
          ? `Showing ${shown.rows.length} of ${shown.total} products · filter to find one`
          : `${tickedRows.length} of ${products.length} products ticked · ${foot}`}
      </Foot>
    </>
  );
}

/** The batch a ticked print row routes to. Sculpture rows have no batch. */
export function batchTagFor(p: FileProduct, kind: ProductKind): ReactElement | null {
  if (kind !== 'print') return null;
  return p.fulfilment === 'framed' ? (
    <Tag tone="steel">Framed</Tag>
  ) : (
    <Tag tone="stone">Unframed</Tag>
  );
}

/** Line items whose titles are ticked — what actually gets written. */
export function tickedItems(items: ParsedLineItem[], ticked: Set<string>): ParsedLineItem[] {
  return items.filter((i) => ticked.has(i.lineItemTitle));
}
