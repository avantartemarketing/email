import { Button, ChoiceList, Popover } from '@shopify/polaris';
import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';

/**
 * Shopify-style column visibility for a table: a "Columns" disclosure button
 * with a checklist, persisted per table. Tables list every field as its own
 * single-line column and let the person choose what they need — never two
 * lines of text stacked in one cell.
 */

export interface ColumnDef {
  id: string;
  title: string;
  /** In the picker but off until switched on. */
  defaultHidden?: boolean;
  /** Always visible and not offered in the picker (e.g. the key column). */
  locked?: boolean;
}

export interface ColumnState {
  /** True when the column should render. */
  show: (id: string) => boolean;
  /** Headings for the currently visible columns, in definition order. */
  headings: { title: string }[];
  /** The "Columns" button + popover, ready to place in a toolbar. */
  columnsButton: ReactElement;
}

function load(storageKey: string, defs: ColumnDef[]): string[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const saved = JSON.parse(raw) as unknown;
      if (Array.isArray(saved)) {
        return defs
          .filter((d) => !d.locked && saved.includes(d.id))
          .map((d) => d.id);
      }
    }
  } catch {
    // Storage unavailable — fall through to defaults.
  }
  return defs.filter((d) => !d.locked && !d.defaultHidden).map((d) => d.id);
}

export function useColumns(tableId: string, defs: ColumnDef[]): ColumnState {
  const storageKey = `pp-columns-${tableId}`;
  const [selected, setSelected] = useState<string[]>(() => load(storageKey, defs));
  const [open, setOpen] = useState(false);

  const change = (ids: string[]): void => {
    if (ids.length === 0) return; // a table with no optional columns left is a mistake
    setSelected(ids);
    try {
      localStorage.setItem(storageKey, JSON.stringify(ids));
    } catch {
      // Best-effort persistence only.
    }
  };

  const visible = useMemo(() => new Set(selected), [selected]);
  const show = (id: string): boolean => {
    const def = defs.find((d) => d.id === id);
    return Boolean(def && (def.locked || visible.has(id)));
  };

  const columnsButton = (
    <Popover
      active={open}
      onClose={() => setOpen(false)}
      activator={
        <Button size="slim" disclosure onClick={() => setOpen((v) => !v)}>
          Columns
        </Button>
      }
    >
      <div style={{ padding: 'var(--p-space-300) var(--p-space-400)' }}>
        <ChoiceList
          allowMultiple
          title="Visible columns"
          titleHidden
          choices={defs.filter((d) => !d.locked).map((d) => ({ label: d.title, value: d.id }))}
          selected={selected}
          onChange={change}
        />
      </div>
    </Popover>
  );

  return {
    show,
    headings: defs.filter((d) => show(d.id)).map((d) => ({ title: d.title })),
    columnsButton,
  };
}
