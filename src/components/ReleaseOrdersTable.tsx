import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import type { Batch, Order, OrderAllocation, ReleaseDetail } from '../types';
import { formatDayShort } from '../logic/dates';
import { inheritedSentStory } from '../logic/reschedule';
import { frameFinishTag, fulfilmentValueTag, plural, specTag } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { Bar, Cap, Dialog, None, Tag } from '../ui/rd';
import { Flag } from '../ui/Flag';
import { DataTable } from '../ui/DataTable';
import type { Column } from '../ui/DataTable';
import usePicked from '../rd/components/usePicked';
import Field from '../rd/components/Field';
import { RescheduleModal } from './RescheduleModal';

/**
 * Every order on the release, in one table — the warehouse's view rather than
 * a batch's.
 *
 * **One row per PRINT, not per order.** The warehouse sheet is one row per
 * physical print (order #AA10418 is a framed print and a print-only one, at
 * two edition numbers), so an order with two prints is two rows here. Joining
 * them would put two edition numbers and two frame finishes in single cells,
 * which is the two-facts-in-a-cell fault this app has already ruled against
 * twice — and it is the shape somebody reconciling against the warehouse sheet
 * is reading down.
 *
 * An order with no allocation yet still gets its row, with the warehouse
 * columns empty: it exists, and a table that hides it until the sheet arrives
 * is a table that undercounts the release.
 */

/**
 * Where an order lives in Shopify.
 *
 * By SEARCH rather than by id: the order export carries the order's name
 * (#AA10412) and not its admin id, so a direct `/orders/<id>` link would need
 * a field we do not import. The search lands on the order itself when the name
 * is unique, which for an order name it is.
 *
 * ⚠ `STORE` is this admin's Shopify store handle and is a guess — the one
 * value on this screen nobody here can verify. Confirm it before anyone
 * relies on these links.
 */
const STORE = 'avant-arte';
const shopifyUrl = (orderName: string): string =>
  `https://admin.shopify.com/store/${STORE}/orders?query=${encodeURIComponent(orderName)}`;

interface Row {
  key: string;
  order: Order;
  batch: Batch | undefined;
  allocation: OrderAllocation | undefined;
}

function rowsFor(orders: Order[], batches: Batch[]): Row[] {
  const byId = new Map(batches.map((b) => [b.id, b]));
  const rows: Row[] = [];
  for (const order of orders) {
    const batch = byId.get(order.batchId);
    if (!order.allocations || order.allocations.length === 0) {
      rows.push({ key: order.id, order, batch, allocation: undefined });
      continue;
    }
    order.allocations.forEach((allocation, i) => {
      rows.push({ key: `${order.id}-${i}`, order, batch, allocation });
    });
  }
  return rows;
}

export function ReleaseOrdersTable({
  detail,
  onChanged,
}: {
  detail: ReleaseDetail;
  onChanged: () => void;
}): ReactElement {
  const { orders, batches } = detail;
  const { data, showToast } = useApp();
  const picked = usePicked();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [moving, setMoving] = useState(false);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  /* Which batch's share of the selection is being re-promised. Null when no
     reschedule is open; the picker below sets it when a selection spans more
     than one. */
  const [promising, setPromising] = useState<string | null>(null);
  const [choosingBatch, setChoosingBatch] = useState(false);

  const active = useMemo(() => orders.filter((o) => !o.removed), [orders]);
  const removed = orders.length - active.length;
  const rows = useMemo(() => rowsFor(active, batches), [active, batches]);

  /* A print row and an order row are not the same thing: a selection is made
     over PRINTS, and the acts below are done to ORDERS. Ticking either print
     of a two-print order selects that order once. */
  const pickedOrderIds = useMemo(
    () => [...new Set(rows.filter((r) => picked.has(r.key)).map((r) => r.order.id))],
    [rows, picked],
  );
  const pickedOrders = active.filter((o) => pickedOrderIds.includes(o.id));
  const pickedBatches = [...new Set(pickedOrders.map((o) => o.batchId))];

  const cancel = async () => {
    setBusy(true);
    try {
      const n = await data.removeOrders(pickedOrderIds, reason);
      showToast(`${plural(n, 'order')} cancelled — no further emails to them`);
      setCancelling(false);
      setReason('');
      picked.clear();
      onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    } finally {
      setBusy(false);
    }
  };

  const move = async () => {
    setBusy(true);
    try {
      const n = await data.moveOrdersToBatch(pickedOrderIds, target);
      const name = batches.find((b) => b.id === target)?.name ?? 'the batch';
      showToast(`${plural(n, 'order')} moved to ${name} — they follow its dates from now on`);
      setMoving(false);
      setTarget('');
      picked.clear();
      onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<Row>[] = [
    {
      id: 'order',
      title: 'Order',
      locked: true,
      kind: 'text',
      value: (r) => r.order.shopifyOrderName,
      cell: (r) => (
        <a
          className="rd-extlink"
          href={shopifyUrl(r.order.shopifyOrderName)}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open ${r.order.shopifyOrderName} in Shopify`}
        >
          {r.order.shopifyOrderName}
        </a>
      ),
    },
    {
      id: 'print',
      title: 'Print name',
      kind: 'text',
      value: (r) => r.allocation?.printName ?? r.order.lineItemTitle,
      cell: (r) => <Cap>{r.allocation?.printName ?? r.order.lineItemTitle}</Cap>,
    },
    {
      id: 'fulfilment',
      title: 'Fulfilment',
      kind: 'choice',
      caption: 'FULFILMENT',
      value: (r) => r.allocation?.fulfilment ?? r.order.variant,
      cell: (r) => fulfilmentValueTag(r.allocation?.fulfilment ?? r.order.variant) ?? <None />,
    },
    {
      id: 'frame',
      title: 'Frame finish',
      kind: 'choice',
      caption: 'FRAME FINISH',
      value: (r) => r.allocation?.frameFinish,
      cell: (r) => frameFinishTag(r.allocation?.frameFinish) ?? <None />,
    },
    {
      id: 'glass',
      title: 'Glass',
      kind: 'choice',
      caption: 'GLASS',
      value: (r) => r.allocation?.glass,
      cell: (r) => specTag(r.allocation?.glass) ?? <None />,
    },
    {
      id: 'mounting',
      title: 'Mounting type',
      defaultHidden: true,
      kind: 'choice',
      caption: 'MOUNTING',
      value: (r) => r.allocation?.mountingType,
      cell: (r) => specTag(r.allocation?.mountingType) ?? <None />,
    },
    {
      id: 'setSize',
      title: 'Set size',
      n: true,
      defaultHidden: true,
      kind: 'number',
      value: (r) => r.allocation?.setSize,
      cell: (r) => r.allocation?.setSize ?? <None />,
    },
    {
      id: 'edition',
      title: 'Edition no.',
      n: true,
      /* Text, not a number: "AP" is a real edition value and sorting it as a
         number would put every proof at nought. */
      kind: 'text',
      value: (r) => r.allocation?.editionNumber,
      cell: (r) => r.allocation?.editionNumber ?? <None />,
    },
    {
      id: 'batch',
      title: 'Batch',
      kind: 'choice',
      caption: 'BATCH',
      value: (r) => r.batch?.name,
      cell: (r) => (r.batch ? <Tag tone="teal">{r.batch.name}</Tag> : <None />),
    },
    {
      id: 'promise',
      title: 'Promise date',
      kind: 'date',
      caption: 'PROMISE DATE',
      value: (r) => r.batch?.promiseDate,
      groupLabel: (key) => (key ? formatDayShort(key) : ''),
      cell: (r) => (r.batch?.promiseDate ? formatDayShort(r.batch.promiseDate) : <None />),
    },
    {
      id: 'customer',
      title: 'Customer',
      kind: 'text',
      value: (r) => r.order.collectorName,
      cell: (r) => <Cap>{r.order.collectorName}</Cap>,
    },
    {
      id: 'email',
      title: 'Customer email',
      kind: 'text',
      value: (r) => r.order.email,
      cell: (r) => (r.order.email ? <Cap>{r.order.email}</Cap> : <None />),
    },
    {
      id: 'country',
      title: 'Country',
      kind: 'choice',
      caption: 'COUNTRY',
      value: (r) => r.order.country,
      /* The flag alone: the column is scanned, not read, and the name is on
         the mark's own title for anyone who does not know it by sight. */
      cell: (r) => <Flag country={r.order.country} />,
    },
    {
      id: 'tags',
      title: 'Shopify tags',
      kind: 'choice',
      caption: 'TAG',
      /* The first tag is what a group or a filter is about. An order with
         several is still findable by search, which sweeps the joined string. */
      value: (r) => r.order.shopifyTags[0],
      searchable: true,
      cell: (r) =>
        r.order.shopifyTags.length > 0 ? (
          r.order.shopifyTags.map((tag) => (
            <Tag key={tag} tone="stone">
              {tag}
            </Tag>
          ))
        ) : (
          <None />
        ),
    },
  ];

  /* Moving is a move BETWEEN batches, so a selection sitting in exactly one
     batch cannot be moved to the batch it is already in. */
  const oneBatch = pickedBatches.length === 1;
  const targetBatches = batches.filter((b) => !oneBatch || b.id !== pickedBatches[0]);

  /*
   * A new promise date is one batch's promise.
   *
   * A promise date lives on a batch, and changing it regenerates that batch's
   * plan and writes one delay email against that batch's dates. A selection
   * spanning three batches is therefore three reschedules with three delay
   * emails, not one act — and doing them silently behind one button would
   * send three different emails from one click. So one batch goes straight
   * into the reschedule flow, and a wider selection is asked which batch's
   * share to re-promise, one at a time. The flow itself already handles the
   * rest: a selection smaller than the batch splits it, which is exactly what
   * picking some of a batch's orders here should do.
   */
  const promisingBatch = batches.find((b) => b.id === promising);
  const promisingOrders = pickedOrders.filter((o) => o.batchId === promising);
  const promisingBatchCount = active.filter((o) => o.batchId === promising).length;
  const promisingSends = detail.sends.filter((s) => s.batchId === promising);

  const startPromise = () => {
    if (pickedBatches.length === 1) setPromising(pickedBatches[0]);
    else setChoosingBatch(true);
  };

  return (
    <>
      <DataTable
        table="release-orders"
        title="All orders"
        noun="print"
        searchPlaceholder="Search orders, collectors, editions"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.key}
        empty="No orders imported for this release yet."
        select={{
          picked,
          label: (r) => `${r.order.shopifyOrderName} — ${r.order.collectorName}`,
          actions: [
            { label: 'Set a new promise date', onClick: startPromise },
            { label: 'Move to another batch', onClick: () => setMoving(true) },
            {
              label: 'Mark cancelled',
              destructive: true,
              onClick: () => setCancelling(true),
            },
          ],
        }}
        foot={
          <>
            {active.length} order{active.length === 1 ? '' : 's'}
            {removed > 0 ? ` · ${removed} cancelled and not listed` : ''}
          </>
        }
      />

      <Dialog
        open={cancelling}
        size="sm"
        title={`Cancel ${plural(pickedOrderIds.length, 'order')}?`}
        onClose={() => setCancelling(false)}
        primary={{
          label: `Cancel ${plural(pickedOrderIds.length, 'order')}`,
          destructive: true,
          onClick: () => void cancel(),
          disabled: busy || !reason.trim(),
        }}
        secondary={{ label: 'Keep them', onClick: () => setCancelling(false) }}
      >
        <Bar tone="warn" title="These collectors stop receiving updates">
          The orders drop out of their batches and out of every future send; emails already sent
          stay in the log. Nothing is refunded or cancelled in Shopify.
        </Bar>
        <div className="rd-fields">
          <Field
            label="Reason"
            value={reason}
            onChange={setReason}
            note="required"
            noteNear={!reason.trim()}
          />
        </div>
      </Dialog>

      <Dialog
        open={moving}
        size="sm"
        title={`Move ${plural(pickedOrderIds.length, 'order')} to another batch`}
        onClose={() => setMoving(false)}
        primary={{
          label: 'Move them',
          onClick: () => void move(),
          disabled: busy || !target,
        }}
        secondary={{ label: 'Cancel', onClick: () => setMoving(false) }}
      >
        <Bar tone="note" title="They take the target batch's dates">
          Moving is a correction, not a new promise: the batch they land in keeps the promise date
          and comms plan it already has, and nothing is sent to say so. To promise a NEW date, use
          Change delivery date on the batch instead.
        </Bar>
        <div className="rd-fields">
          {targetBatches.map((b) => (
            <button
              key={b.id}
              type="button"
              role="radio"
              aria-checked={target === b.id}
              className={target === b.id ? 'rd-pickrow on' : 'rd-pickrow'}
              onClick={() => setTarget(b.id)}
            >
              <span className="rd-pickname">{b.name}</span>
              <span className="rd-picknote">
                {b.promiseDate ? formatDayShort(b.promiseDate) : 'no promise date yet'}
              </span>
            </button>
          ))}
        </div>
      </Dialog>

      <Dialog
        open={choosingBatch}
        size="sm"
        title="Which batch's date is changing?"
        onClose={() => setChoosingBatch(false)}
        secondary={{ label: 'Cancel', onClick: () => setChoosingBatch(false) }}
      >
        <Bar tone="note" title="A promise date belongs to one batch">
          Your selection spans {plural(pickedBatches.length, 'batch', 'batches')}, and each has its
          own date, plan and delay email. Do them one at a time — the rest of the selection stays
          ticked.
        </Bar>
        <div className="rd-fields">
          {batches
            .filter((b) => pickedBatches.includes(b.id))
            .map((b) => {
              const mine = pickedOrders.filter((o) => o.batchId === b.id).length;
              return (
                <button
                  key={b.id}
                  type="button"
                  className="rd-pickrow"
                  onClick={() => {
                    setChoosingBatch(false);
                    setPromising(b.id);
                  }}
                >
                  <span className="rd-pickname">{b.name}</span>
                  <span className="rd-picknote">
                    {plural(mine, 'selected order')} ·{' '}
                    {b.promiseDate ? formatDayShort(b.promiseDate) : 'no promise date yet'}
                  </span>
                </button>
              );
            })}
        </div>
      </Dialog>

      {promisingBatch ? (
        <RescheduleModal
          open
          onClose={() => setPromising(null)}
          release={detail.release}
          batch={promisingBatch}
          batchLabel={batches.length > 1 ? promisingBatch.name : null}
          selectedOrders={promisingOrders}
          batchActiveOrderCount={promisingBatchCount}
          batchSends={promisingSends}
          inheritedSentSends={inheritedSentStory(promisingBatch, batches, detail.sends)}
          onDone={(message) => {
            setPromising(null);
            picked.clear();
            showToast(message);
            onChanged();
          }}
        />
      ) : null}
    </>
  );
}
