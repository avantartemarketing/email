import type { ReactElement } from 'react';
import type { Batch, Order, OrderAllocation } from '../types';
import { formatDayShort } from '../logic/dates';
import { plural } from '../ui/format';
import { useColumns } from '../ui/useColumns';
import { Cap, Card, CardHead, Foot, None, Tag } from '../ui/rd';

/**
 * Every order on the release, in one table — the warehouse's view rather than
 * a batch's.
 *
 * **One row per PRINT, not per order.** The warehouse sheet is one row per
 * physical print (order #AA10418 is a framed print and a print-only one, at
 * two edition numbers), so an order with two prints is two rows here. Joining
 * them into one row would put two edition numbers and two frame finishes in
 * single cells, which is the two-facts-in-a-cell fault this app has already
 * ruled against twice — and it is the shape somebody reconciling against the
 * warehouse sheet is reading down.
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
  const columns = useColumns('release-orders', [
    { id: 'order', title: 'Order', locked: true },
    { id: 'print', title: 'Print name' },
    { id: 'fulfilment', title: 'Fulfilment' },
    { id: 'frame', title: 'Frame finish' },
    { id: 'glass', title: 'Glass' },
    { id: 'mounting', title: 'Mounting type', defaultHidden: true },
    { id: 'setSize', title: 'Set size', n: true, defaultHidden: true },
    { id: 'edition', title: 'Edition no.', n: true },
    { id: 'batch', title: 'Batch' },
    { id: 'promise', title: 'Promise date' },
    { id: 'customer', title: 'Customer' },
    { id: 'email', title: 'Customer email' },
    { id: 'country', title: 'Country' },
    { id: 'tags', title: 'Shopify tags' },
  ]);

  const active = orders.filter((o) => !o.removed);
  const removed = orders.filter((o) => o.removed);
  const rows = rowsFor(active, batches);
  const allocated = rows.filter((r) => r.allocation).length;

  return (
    <Card>
      <CardHead title="All orders" actions={columns.menu} />
      <div className="rd-scroll">
        <table className="rd-t rd-t27 rd-fit rd-tpad">
          <thead>
            <tr>{columns.head}</tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="rd-prose" colSpan={columns.count}>
                  No orders imported for this release yet.
                </td>
              </tr>
            ) : (
              rows.map(({ key, order, batch, allocation }) => (
                <tr key={key}>
                  <td className="rd-ink">
                    <a
                      className="rd-cellink"
                      href={shopifyUrl(order.shopifyOrderName)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Open ${order.shopifyOrderName} in Shopify`}
                    >
                      {order.shopifyOrderName}
                    </a>
                  </td>
                  {columns.show('print') ? (
                    <td>
                      {allocation?.printName ? (
                        <Cap>{allocation.printName}</Cap>
                      ) : (
                        <Cap>{order.lineItemTitle}</Cap>
                      )}
                    </td>
                  ) : null}
                  {columns.show('fulfilment') ? (
                    <td>{allocation?.fulfilment ?? order.variant ?? <None />}</td>
                  ) : null}
                  {columns.show('frame') ? <td>{allocation?.frameFinish ?? <None />}</td> : null}
                  {columns.show('glass') ? <td>{allocation?.glass ?? <None />}</td> : null}
                  {columns.show('mounting') ? (
                    <td>{allocation?.mountingType ?? <None />}</td>
                  ) : null}
                  {columns.show('setSize') ? (
                    <td className="n">{allocation?.setSize ?? <None />}</td>
                  ) : null}
                  {columns.show('edition') ? (
                    <td className="n">{allocation?.editionNumber ?? <None />}</td>
                  ) : null}
                  {columns.show('batch') ? <td>{batch?.name ?? <None />}</td> : null}
                  {columns.show('promise') ? (
                    <td>{batch?.promiseDate ? formatDayShort(batch.promiseDate) : <None />}</td>
                  ) : null}
                  {columns.show('customer') ? (
                    <td>
                      <Cap>{order.collectorName}</Cap>
                    </td>
                  ) : null}
                  {columns.show('email') ? (
                    <td>{order.email ? <Cap>{order.email}</Cap> : <None />}</td>
                  ) : null}
                  {columns.show('country') ? <td>{order.country ?? <None />}</td> : null}
                  {columns.show('tags') ? (
                    <td>
                      {order.shopifyTags.length > 0 ? (
                        order.shopifyTags.map((tag) => (
                          <Tag key={tag} tone="stone">
                            {tag}
                          </Tag>
                        ))
                      ) : (
                        <None />
                      )}
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Foot>
        {plural(active.length, 'order')} · {rows.length} print
        {rows.length === 1 ? '' : 's'} · {allocated} allocated by the warehouse
        {removed.length > 0 ? ` · ${removed.length} removed and not listed` : ''}
      </Foot>
    </Card>
  );
}
