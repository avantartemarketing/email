import { useMemo } from 'react';
import type { ReactElement } from 'react';
import type { Batch, Order, OrderAllocation } from '../types';
import { formatDayShort } from '../logic/dates';
import { Cap, None, Tag } from '../ui/rd';
import { DataTable } from '../ui/DataTable';
import type { Column } from '../ui/DataTable';

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
  orders,
  batches,
}: {
  orders: Order[];
  batches: Batch[];
}): ReactElement {
  const active = useMemo(() => orders.filter((o) => !o.removed), [orders]);
  const removed = orders.length - active.length;
  const rows = useMemo(() => rowsFor(active, batches), [active, batches]);

  const columns: Column<Row>[] = [
    {
      id: 'order',
      title: 'Order',
      locked: true,
      kind: 'text',
      value: (r) => r.order.shopifyOrderName,
      cell: (r) => (
        <a
          className="rd-cellink"
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
      cell: (r) => r.allocation?.fulfilment ?? r.order.variant ?? <None />,
    },
    {
      id: 'frame',
      title: 'Frame finish',
      kind: 'choice',
      caption: 'FRAME FINISH',
      value: (r) => r.allocation?.frameFinish,
      cell: (r) => r.allocation?.frameFinish ?? <None />,
    },
    {
      id: 'glass',
      title: 'Glass',
      kind: 'choice',
      caption: 'GLASS',
      value: (r) => r.allocation?.glass,
      cell: (r) => r.allocation?.glass ?? <None />,
    },
    {
      id: 'mounting',
      title: 'Mounting type',
      defaultHidden: true,
      kind: 'choice',
      caption: 'MOUNTING',
      value: (r) => r.allocation?.mountingType,
      cell: (r) => r.allocation?.mountingType ?? <None />,
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
      cell: (r) => r.batch?.name ?? <None />,
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
      cell: (r) => r.order.country ?? <None />,
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

  return (
    <DataTable
      table="release-orders"
      title="All orders"
      noun="print"
      searchPlaceholder="Search orders, collectors, editions"
      columns={columns}
      rows={rows}
      rowKey={(r) => r.key}
      empty="No orders imported for this release yet."
      foot={
        <>
          {active.length} order{active.length === 1 ? '' : 's'}
          {removed > 0 ? ` · ${removed} removed and not listed` : ''}
        </>
      }
    />
  );
}
