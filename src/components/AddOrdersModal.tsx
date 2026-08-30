import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import type { ProductKind, Release } from '../types';
import type { ParseResult } from '../logic/importer';
import type { FileProduct } from '../logic/intake';
import { planIntake, shopifyOrderCount } from '../logic/intake';
import { plural } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { Bar, Facts } from '../ui/rd';
import {
  FileProductsTable,
  OrderIntakeDialog,
  batchTagFor,
  tickedItems,
} from './OrderIntakeDialog';
import { IntakeNotes } from './IntakeNotes';

/**
 * Adding orders to a release that already exists — the RECURRING job.
 *
 * Orders keep arriving after a drop, so this is the normal case and the create
 * door is the special one. Same dialogue, same file pane, minus the release
 * form: the ticks arrive already set from what this release claims, and the
 * table gains the one column somebody actually opens this to read — how many
 * of these are not here yet.
 *
 * Re-uploading the same file was always safe (dedupe is on the record, not the
 * file). What is new is being able to SEE that it is safe before pressing the
 * button: "In file 158, New 3".
 */
export function AddOrdersModal({
  open,
  release,
  existing,
  onClose,
  onAdded,
}: {
  open: boolean;
  release: Release;
  /** This release's orders, for the reconcile. */
  existing: { shopifyOrderName: string; lineItemTitle: string; removed: boolean }[];
  onClose: () => void;
  onAdded: () => void;
}): ReactElement {
  const { data, showToast } = useApp();
  const [parse, setParse] = useState<{
    result: ParseResult;
    products: FileProduct[];
    fileName: string;
  } | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);

  const claimed = release.productMatch.lineItemTitles;

  const close = (): void => {
    setParse(null);
    setTicked(new Set());
    onClose();
  };

  const onRead = (result: ParseResult, products: FileProduct[], fileName: string): void => {
    setParse({ result, products, fileName });
    /* Pre-ticked by EXACT string equality against what this release claims —
       never through `filterItemsForRelease`. A release set up without a file
       claims nothing, and a claim on nothing must pre-tick nothing rather than
       everything in the file. */
    setTicked(new Set(products.filter((p) => claimed.includes(p.lineItemTitle)).map((p) => p.lineItemTitle)));
  };

  const toggle = (lineItemTitle: string): void =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(lineItemTitle)) next.delete(lineItemTitle);
      else next.add(lineItemTitle);
      return next;
    });

  const plan = useMemo(
    () => (parse ? planIntake(parse.result.items, [...ticked], existing, release.productKind) : null),
    [parse, ticked, existing, release.productKind],
  );

  /* How many of each row are not here yet — the column this is opened for. */
  const newByTitle = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of plan?.create ?? []) {
      counts.set(item.lineItemTitle, (counts.get(item.lineItemTitle) ?? 0) + 1);
    }
    return counts;
  }, [plan]);

  const foreign = parse
    ? [...ticked].filter((t) => claimed.length > 0 && !claimed.includes(t))
    : [];

  const why =
    ticked.size === 0
      ? claimed.length === 0
        ? 'This release does not claim a product yet — tick one.'
        : 'Tick at least one product.'
      : (plan?.create.length ?? 0) === 0
        ? 'Every order in this file is already here.'
        : undefined;

  const add = async (): Promise<void> => {
    if (!parse) return;
    setSaving(true);
    try {
      const intake = await data.addOrders(
        release.id,
        tickedItems(parse.result.items, ticked),
        { kind: 'csv_upload', label: parse.fileName },
      );
      const made = intake.summary.batchesCreated;
      showToast(
        made.length > 0
          ? `${plural(intake.summary.newOrders, 'order')} added — ${made
              .map((b) => b.name)
              .join(' and ')} created`
          : `${plural(intake.summary.newOrders, 'order')} added`,
      );
      setParse(null);
      setTicked(new Set());
      onClose();
      onAdded();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <OrderIntakeDialog
      open={open}
      title={`Add orders — ${release.title}`}
      onClose={close}
      onRead={onRead}
      parse={parse ? { fileName: parse.fileName } : null}
      primary={{
        label: `Add ${plural(plan?.create.length ?? 0, 'order')}`,
        onClick: () => void add(),
        disabled: saving || why !== undefined,
        why: saving ? 'Adding…' : why,
      }}
      secondary={{ label: 'Back', onClick: () => setParse(null) }}
    >
      {parse && plan ? (
        <>
          {foreign.length > 0 ? (
            <Bar tone="warn" title="A product this release does not claim yet">
              Ticking “{foreign[0]}” adds it to what {release.title} claims from now on.
            </Bar>
          ) : null}

          <FileProductsTable
            products={parse.products}
            ticked={ticked}
            onToggle={toggle}
            newByTitle={newByTitle}
            fulfilmentTagOf={(p) => batchTagFor(p, release.productKind as ProductKind)}
            foot={`${plural(plan.create.length, 'new order')} from ${plural(
              shopifyOrderCount(parse.result.items, [...ticked]),
              'Shopify order',
            )} in this file`}
          />

          <div className="rd-after">
            <div className="rd-after-t">What this adds</div>
            <Facts
              items={[
                { label: 'New orders', value: plan.create.length },
                { label: 'Already here', value: plan.alreadyHere },
                ...(plan.stillCancelled > 0
                  ? [{ label: 'Cancelled here', value: plan.stillCancelled }]
                  : []),
                { label: 'Collectors', value: plan.collectors },
              ]}
            />
          </div>

          <IntakeNotes notes={plan.notes} />
        </>
      ) : null}
    </OrderIntakeDialog>
  );
}
