/**
 * Which columns a table is showing, and the control that changes it.
 *
 * The kit's `ColumnsMenu` is the control — one chip, drawn the same way
 * wherever a table can put a column away, because three copies of a menu is
 * three chances to word it differently. This adds what a screen also needs and
 * the kit leaves to its host: the choice REMEMBERED (a column put away comes
 * back put away tomorrow), and the header cells themselves, so a table cannot
 * draw a heading whose cells it is no longer rendering.
 *
 * A locked column has no entry in the menu at all. The kit's own note on this
 * is the rule: what is not offered is as deliberate as what is — the tick
 * gutter, because it is how a selection is made, and any column carrying a
 * warning, because a list you can hide the warnings on is a list that stops
 * warning you.
 */
import { useCallback, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import ColumnsMenu from '../rd/components/ColumnsMenu';
import { NAMESPACE } from '../rd/lib/view';

export interface ColumnDef {
  id: string;
  title: string;
  /** A figure column: right-aligned, tabular. */
  n?: boolean;
  /** Off until somebody asks for it — a spec field, a second identifier. */
  defaultHidden?: boolean;
  /** Never offered: identity, status, the row's own actions. */
  locked?: boolean;
}

const key = (table: string) => `${NAMESPACE}.columns.${table}`;

function read(table: string): string[] | null {
  try {
    const raw = localStorage.getItem(key(table));
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    // A browser that refuses storage still gets a working table.
    return null;
  }
}

export function useColumns(
  table: string,
  defs: ColumnDef[],
): {
  show: (id: string) => boolean;
  /** The `<th>`s, ready to drop into the header row. */
  head: ReactElement[];
  /** How many cells a row draws — what a spanning row has to cover. */
  count: number;
  menu: ReactElement;
} {
  const [hidden, setHidden] = useState<Set<string>>(() => {
    const stored = read(table);
    if (stored) return new Set(stored);
    return new Set(defs.filter((d) => d.defaultHidden && !d.locked).map((d) => d.id));
  });

  const toggle = useCallback(
    (id: string) => {
      setHidden((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        try {
          localStorage.setItem(key(table), JSON.stringify([...next]));
        } catch {
          // Not remembering is a smaller fault than not working.
        }
        return next;
      });
    },
    [table],
  );

  const show = useCallback((id: string) => !hidden.has(id), [hidden]);
  const visible = useMemo(() => defs.filter((d) => d.locked || !hidden.has(d.id)), [defs, hidden]);

  const head = visible.map((d) => (
    <th key={d.id} className={d.n ? 'n' : undefined} scope="col">
      {d.title}
    </th>
  ));

  const menu = (
    <ColumnsMenu
      columns={defs
        .filter((d) => !d.locked)
        .map((d) => ({ id: d.id, label: d.title, width: null, n: d.n }))}
      hidden={hidden}
      onToggle={toggle}
    />
  );

  return { show, head, count: visible.length, menu };
}
