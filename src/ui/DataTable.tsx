import { useCallback, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { Cell, FieldKind, ViewField, ViewState } from '../rd/lib/view';
import { EMPTY_VIEW, applyView, storageKey } from '../rd/lib/view';
import ViewControls from '../rd/components/ViewControls';
import ColumnsMenu from '../rd/components/ColumnsMenu';
import GroupBand from '../rd/components/GroupBand';
import BulkBar from '../rd/components/BulkBar';
import type { BulkAction } from '../rd/components/BulkBar';
import RowTick from '../rd/components/RowTick';
import type { Picked } from '../rd/components/usePicked';
import { useGridPin } from '../rd/components/useGridPin';
import { Card, CardHead, Foot } from './rd';

/**
 * Every table in this app, once.
 *
 * The kit's argument, which this is the local shape of: *"a screen declares its
 * fields once — id, label, type, how to read the value — and all four controls
 * are derived from that one list."* Before it, six tables here had a Columns
 * control and nothing else: no search, no filter, no grouping, no sort. Adding
 * four controls to six tables by hand is six chances to word them differently
 * and six places to fix the next bug in.
 *
 * So a screen declares its COLUMNS — what to call each one, how to draw its
 * cell, and (where the column is a fact you can ask questions of) how to read
 * its value. From that one list this derives:
 *
 *   - the header row and the cells, in the same order, so a heading can never
 *     end up over the wrong figures;
 *   - the Fields menu, which offers every column that is not `locked`;
 *   - Group, Sort and Filter, which offer every column that has a `value` and
 *     has not opted out.
 *
 * A column with no `value` is a column that is not a fact: an actions gutter, a
 * cell of buttons. It draws and is never offered. A column that is a fact but
 * must not be hidden — the identity, a status carrying a warning — is `locked`:
 * "a list you can hide the warnings on is a list that stops warning you".
 *
 * The view survives a reload, per table, because a filter somebody set and then
 * lost is worse than no filter at all.
 */

export interface Column<T> {
  id: string;
  /** The heading, and what the four controls call it. One word for both. */
  title: string;
  cell: (row: T) => ReactNode;
  /** A figure column: right-aligned and tabular, on the `th` and the `td`. */
  n?: boolean;
  /** Off until somebody asks for it. */
  defaultHidden?: boolean;
  /** Never offered in the Fields menu — identity, actions, a warning. */
  locked?: boolean;

  // --- the view model. Omit `value` and the column is drawn but not asked. ---
  kind?: FieldKind;
  value?: (row: T) => Cell;
  /** What a band says this grouping IS — "STATUS", "BATCH" (ruling 14). */
  caption?: string;
  /** How a group's key prints, where the raw value is not what to show. */
  groupLabel?: (key: string, rows: T[]) => string;
  /** A fixed vocabulary's own order, for both the bands and the filter menu. */
  order?: readonly string[];
  /**
   * The band says everything this cell does, so the column comes off the grid
   * while grouped by it.
   *
   * Opt-in, not automatic: it is only true where the cell is the bare value
   * the band prints. A cell that adds anything — a pill, a marker, an action
   * — still earns its column under its own band, and dropping every grouped
   * column unconditionally took a LOCKED warning column off the approvals
   * table the moment somebody grouped by it.
   */
  bandReplaces?: boolean;
  sortable?: boolean;
  groupable?: boolean;
  filterable?: boolean;
  searchable?: boolean;
}

/** Remembered per table, so a filter set yesterday is still set today. */
function readView(table: string, initial?: Partial<ViewState>): ViewState {
  try {
    const raw = localStorage.getItem(storageKey(table));
    /* A table may open pre-arranged — the batches page IS "grouped by
       release", so arriving flat would be arriving broken. The initial view
       fills in only while nothing is remembered: the first change the user
       makes is stored and wins from then on, so the default is a starting
       point rather than a preference they cannot shake off. */
    if (!raw) return { ...EMPTY_VIEW, ...initial };
    const parsed = JSON.parse(raw) as Partial<ViewState>;
    return {
      search: parsed.search ?? '',
      filters: parsed.filters ?? [],
      group: parsed.group ?? '',
      sort: parsed.sort ?? [],
    };
  } catch {
    /* A browser refusing storage still gets a working table — and still gets
       the table it was designed as: dropping `initial` here opened the
       batches page flat in exactly the case this catch exists for. */
    return { ...EMPTY_VIEW, ...initial };
  }
}

export function useView(
  table: string,
  initial?: Partial<ViewState>,
): [ViewState, (next: ViewState) => void] {
  const [state, setState] = useState<ViewState>(() => readView(table, initial));
  const set = useCallback(
    (next: ViewState) => {
      setState(next);
      try {
        localStorage.setItem(storageKey(table), JSON.stringify(next));
      } catch {
        // Not remembering is a smaller fault than not working.
      }
    },
    [table],
  );
  return [state, set];
}

/** Which columns are put away. Same store as the view, different key. */
function readHidden(table: string, columns: Column<unknown>[]): Set<string> {
  try {
    const raw = localStorage.getItem(`${storageKey(table)}.fields`);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    /* fall through to the defaults */
  }
  return new Set(columns.filter((c) => c.defaultHidden && !c.locked).map((c) => c.id));
}

export function DataTable<T>({
  table,
  title,
  columns,
  rows,
  rowKey,
  onRowClick,
  searchPlaceholder,
  empty,
  foot,
  select,
  headActions,
  noun = 'row',
  nounPlural,
  defaultView,
}: {
  /** Stable id — what the view and the hidden columns are remembered against. */
  table: string;
  /** The card's own name. Omitted where the page title already says it. */
  title?: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  searchPlaceholder?: string;
  /** Said when there are no rows at all — not when a filter emptied it. */
  empty: ReactNode;
  /** Extra words in the foot, after the count. */
  foot?: ReactNode;
  /** A ticked table: the gutter, the range gesture and the bulk bar. */
  select?: { picked: Picked; label: (row: T) => string; actions: BulkAction[] };
  /** Controls that act on this table, in its card head. */
  headActions?: ReactNode;
  /** What one row IS, for the count — "order", "send". */
  noun?: string;
  /** Its plural, where adding an s is not it — "batches". */
  nounPlural?: string;
  /** How the table opens before anyone touches its view controls. */
  defaultView?: Partial<ViewState>;
}): ReactElement {
  const [view, setView] = useView(table, defaultView);
  const [hidden, setHidden] = useState<Set<string>>(() =>
    readHidden(table, columns as Column<unknown>[]),
  );

  const toggleField = useCallback(
    (id: string) => {
      setHidden((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        try {
          localStorage.setItem(`${storageKey(table)}.fields`, JSON.stringify([...next]));
        } catch {
          /* not remembering is a smaller fault than not working */
        }
        return next;
      });
    },
    [table],
  );

  /* The view's fields are the columns that carry a value. A column without one
     is a gutter or a row of buttons: it is drawn and never asked about. */
  const fields = useMemo<ViewField<T>[]>(
    () =>
      columns
        .filter((c) => c.value)
        .map((c) => ({
          id: c.id,
          label: c.title,
          kind: c.kind ?? 'text',
          value: c.value!,
          caption: c.caption,
          groupLabel: c.groupLabel,
          order: c.order,
          sortable: c.sortable,
          groupable: c.groupable,
          filterable: c.filterable,
          searchable: c.searchable,
        })),
    [columns],
  );

  const { rows: kept, groups } = applyView(rows, fields, view);
  const grouping = fields.find((f) => f.id === view.group);
  /* The grouped column comes OFF the grid while its bands are drawn: every
     band already prints the value, and a column repeating what the heading
     above it just said is two marks for one fact. Ungrouping brings it
     straight back, locked or not — locked means "not hideable by hand",
     and this is not by hand. */
  const visible = columns.filter(
    (c) => (c.locked || !hidden.has(c.id)) && !(grouping && c.id === view.group && c.bandReplaces),
  );
  const span = visible.length + (select ? 1 : 0);
  const groupCaption =
    columns.find((c) => c.id === view.group)?.caption ?? grouping?.label.toUpperCase() ?? '';

  const pin = useGridPin(Boolean(select && select.picked.size > 0));

  const fieldsMenu = (
    <ColumnsMenu
      columns={columns
        .filter((c) => !c.locked)
        .map((c) => ({ id: c.id, label: c.title, width: null, n: c.n }))}
      hidden={hidden}
      onToggle={toggleField}
    />
  );

  const body = (rowsIn: T[]): ReactNode[] =>
    rowsIn.map((row) => {
      const id = rowKey(row);
      return (
        <tr
          key={id}
          className={onRowClick ? 'rd-rowlink' : undefined}
          /* A control inside a clickable row ACTS; it does not also navigate.
             Every cell would otherwise need its own stopPropagation, and the
             one that forgot was the releases index's next-send menu: clicking
             the date opened the release instead of the menu, because the menu's
             button is the kit's and knows nothing about the row it sits in.
             Asked of the event rather than declared per column, so a control
             added to a cell later cannot get this wrong. */
          onClick={
            onRowClick
              ? (e) => {
                  if ((e.target as HTMLElement).closest('button, a, input, label')) return;
                  onRowClick(row);
                }
              : undefined
          }
        >
          {select ? (
            <td onClick={(e) => e.stopPropagation()}>
              <RowTick
                id={id}
                on={select.picked.has(id)}
                label={select.label(row)}
                onPress={select.picked.press}
              />
            </td>
          ) : null}
          {visible.map((c) => (
            <td key={c.id} className={c.n ? 'n' : undefined}>
              {c.cell(row)}
            </td>
          ))}
        </tr>
      );
    });

  return (
    <Card>
      {title || headActions ? <CardHead title={title ?? ''} actions={headActions} /> : null}
      <div style={{ padding: '0 var(--rd-card-inset)' }}>
        <ViewControls
          fields={fields}
          rows={rows}
          state={view}
          onChange={setView}
          searchPlaceholder={searchPlaceholder ?? `Search ${noun}s`}
          fieldsMenu={fieldsMenu}
        />
      </div>
      <div className="rd-scroll">
        <table
          className={`rd-t rd-t27 rd-fit rd-tpad${select ? ' rd-tsel' : ''}`}
          ref={pin.ref}
          style={pin.style}
        >
          {pin.cols}
          <thead>
            {select && select.picked.size > 0 ? (
              <BulkBar count={select.picked.size} columns={span} actions={select.actions} />
            ) : (
              <tr>
                {select ? <th aria-hidden /> : null}
                {visible.map((c) => (
                  <th key={c.id} className={c.n ? 'n' : undefined} scope="col">
                    {c.title}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="rd-prose" colSpan={span}>
                  {empty}
                </td>
              </tr>
            ) : kept.length === 0 ? (
              /* A filter emptied it. Saying so is the point: a table that goes
                 blank without explaining is a table somebody reloads. */
              <tr>
                <td className="rd-prose" colSpan={span}>
                  Nothing matches the filters on this table. Remove a chip above to see more.
                </td>
              </tr>
            ) : grouping ? (
              groups.flatMap((g) => [
                <GroupBand key={`band-${g.key}`} columns={span} caption={groupCaption}>
                  {g.label}
                </GroupBand>,
                ...body(g.rows),
              ])
            ) : (
              body(kept)
            )}
          </tbody>
        </table>
      </div>
      <Foot>
        {kept.length === rows.length
          ? `${rows.length} ${rows.length === 1 ? noun : (nounPlural ?? `${noun}s`)}`
          : `${kept.length} of ${rows.length} ${rows.length === 1 ? noun : (nounPlural ?? `${noun}s`)}`}
        {select && select.picked.size > 0 ? ` · ${select.picked.size} selected` : ''}
        {foot ? <> · {foot}</> : null}
      </Foot>
    </Card>
  );
}
