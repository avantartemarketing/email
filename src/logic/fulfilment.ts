import type { Order } from '../types';

/**
 * What the shop's own fields say about an order's delivery state — the view
 * Elani builds her lists from (10 Sep 2026): "the Shopify fulfilment status
 * is probably the most accurate view on whether something has dispatched",
 * and the holds are excluded "because that's on the collector's request".
 *
 * ⚠ The hold is read from the order's tags — any tag containing the word
 * "hold". The exact tag customer support uses needs confirming with Elani;
 * the SOP she shared is the source of truth for the vocabulary.
 */

export function isOnHold(order: Pick<Order, 'shopifyTags'>): boolean {
  return (order.shopifyTags ?? []).some((t) => /\bhold\b/i.test(t));
}

export function isFulfilled(order: Pick<Order, 'fulfillmentStatus'>): boolean {
  return order.fulfillmentStatus === 'fulfilled';
}

/** The one word the Fulfilment column says. Hold outranks the status: a held
    order is unfulfilled by definition, and the hold is the fact that changes
    what we send them. */
export function fulfilmentLabel(
  order: Pick<Order, 'shopifyTags' | 'fulfillmentStatus'>,
): 'On hold' | 'Fulfilled' | 'Partial' | 'Unfulfilled' {
  if (isOnHold(order)) return 'On hold';
  if (order.fulfillmentStatus === 'fulfilled') return 'Fulfilled';
  if (order.fulfillmentStatus === 'partial') return 'Partial';
  return 'Unfulfilled';
}

/**
 * Whether a send should reach this order. Two exclusions, both Elani's:
 * holds never hear from the plan (the pause was the collector's own ask),
 * and a DELAY notice never goes to an order that has already dispatched —
 * "sorry, your artwork is late" to somebody holding it.
 */
export function receivesSend(
  order: Pick<Order, 'shopifyTags' | 'fulfillmentStatus'>,
  send: Pick<{ type: 'milestone' | 'delay' }, 'type'>,
): boolean {
  if (isOnHold(order)) return false;
  if (send.type === 'delay' && isFulfilled(order)) return false;
  return true;
}
