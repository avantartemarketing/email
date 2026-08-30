import { describe, expect, it } from 'vitest';
import {
  filterItemsForRelease,
  orderDedupeKey,
  parseShopifyOrderExport,
  splitLineItemTitle,
} from '../importer';

const HEADER =
  'Name,Email,Financial Status,Paid at,Fulfillment Status,Currency,Subtotal,Created at,Lineitem quantity,Lineitem name,Lineitem price,Lineitem sku,Billing Name,Shipping Name';

function csv(...rows: string[]): string {
  return [HEADER, ...rows].join('\n');
}

describe('parseShopifyOrderExport', () => {
  it('parses a straightforward export row', () => {
    const result = parseShopifyOrderExport(
      csv(
        '#AA1001,jane@example.com,paid,2026-05-14 11:23:45 +0100,unfulfilled,GBP,540.00,2026-05-14 11:23:45 +0100,1,Falling Light - Framed,540.00,FL-F,Jane Smith,Jane Smith',
      ),
    );
    expect(result.rowsParsed).toBe(1);
    expect(result.issues).toEqual([]);
    expect(result.items).toEqual([
      {
        shopifyOrderName: '#AA1001',
        lineItemTitle: 'Falling Light - Framed',
        variant: 'Framed',
        quantity: 1,
        sku: 'FL-F',
        financialStatus: 'paid',
        fulfillmentStatus: 'unfulfilled',
        email: 'jane@example.com',
        collectorName: 'Jane Smith',
        orderDate: '2026-05-14',
        country: null,
        shopifyTags: [],
        row: 1,
      },
    ]);
  });

  /* Both columns are optional — the header above has neither, and an export cut
     down by hand often does not. An order with no tags is ordinary, not a
     fault, so the absence must parse rather than report. */
  it('reads shipping country and tags, and carries them onto continuation rows', () => {
    const header =
      'Name,Email,Created at,Lineitem quantity,Lineitem name,Billing Name,Shipping Country,Tags';
    const result = parseShopifyOrderExport(
      [
        header,
        '#AA1010,rosa@example.com,2026-05-14 11:00:00 +0100,1,Falling Light - Framed,Rosa Delgado,Spain,"vip,repeat-collector"',
        ',,,1,Falling Light - Unframed,,,',
      ].join('\n'),
    );
    expect(result.issues).toEqual([]);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].country).toBe('Spain');
    expect(result.items[0].shopifyTags).toEqual(['vip', 'repeat-collector']);
    // The continuation row is the same order, so it is the same country and tags.
    expect(result.items[1].country).toBe('Spain');
    expect(result.items[1].shopifyTags).toEqual(['vip', 'repeat-collector']);
  });

  it('falls back to billing country when there is no shipping country', () => {
    const result = parseShopifyOrderExport(
      [
        'Name,Email,Created at,Lineitem quantity,Lineitem name,Billing Name,Billing Country',
        '#AA1011,leo@example.com,2026-05-14 11:00:00 +0100,1,Falling Light - Framed,Leo Marchetti,Italy',
      ].join('\n'),
    );
    expect(result.items[0].country).toBe('Italy');
  });

  it('carries order-level fields onto continuation rows of multi-line-item orders', () => {
    const result = parseShopifyOrderExport(
      csv(
        '#AA1002,sam@example.com,paid,,unfulfilled,GBP,940.00,2026-05-15 09:00:00 +0100,1,Falling Light - Framed,540.00,FL-F,"Watts, Sam","Watts, Sam"',
        '#AA1002,,,,,,,,1,Falling Light - Unframed,400.00,FL-U,,',
      ),
    );
    expect(result.items).toHaveLength(2);
    const second = result.items[1];
    expect(second.email).toBe('sam@example.com');
    expect(second.collectorName).toBe('Watts, Sam');
    expect(second.orderDate).toBe('2026-05-15');
    expect(second.variant).toBe('Unframed');
  });

  it('carries fields forward when continuation rows leave Name blank', () => {
    const result = parseShopifyOrderExport(
      csv(
        '#AA1003,kai@example.com,paid,,unfulfilled,GBP,940.00,2026-05-16 10:00:00 +0100,1,Falling Light - Framed,540.00,FL-F,Kai Ito,Kai Ito',
        ',,,,,,,,1,Vessel VIII - Sculpture,1200.00,V8,,',
      ),
    );
    expect(result.items).toHaveLength(2);
    expect(result.items[1].shopifyOrderName).toBe('#AA1003');
    expect(result.items[1].email).toBe('kai@example.com');
  });

  it('keeps rows with missing email instead of dropping them', () => {
    const result = parseShopifyOrderExport(
      csv(
        '#AA1004,,paid,,unfulfilled,GBP,540.00,2026-05-17 10:00:00 +0100,1,Falling Light - Framed,540.00,FL-F,Ana Costa,Ana Costa',
      ),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].email).toBeNull();
    expect(result.items[0].collectorName).toBe('Ana Costa');
  });

  it('reports rows without a line item name as issues', () => {
    const result = parseShopifyOrderExport(
      csv('#AA1005,x@example.com,paid,,unfulfilled,GBP,0,2026-05-18 10:00:00 +0100,,,,,X Y,X Y'),
    );
    expect(result.items).toHaveLength(0);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].reason).toContain('#AA1005');
  });

  it('reports missing order dates as issues but still imports the row', () => {
    const result = parseShopifyOrderExport(
      csv('#AA1006,y@example.com,paid,,unfulfilled,GBP,540,,1,Falling Light - Framed,540,FL-F,Yu Chen,Yu Chen'),
    );
    expect(result.items).toHaveLength(1);
    expect(result.issues.some((i) => i.reason.includes('Created at'))).toBe(true);
  });

  /* A fault about the FILE, and never a row: the two used to share a channel,
     so an empty file was drawn as "1 row could not be read" over the body
     "Everything else was imported." */
  it('rejects files missing required columns as a whole-file fault', () => {
    const result = parseShopifyOrderExport('Foo,Bar\n1,2');
    expect(result.items).toHaveLength(0);
    expect(result.issues).toEqual([]);
    expect(result.fault).toEqual({
      kind: 'not_an_export',
      detail: 'No Name or Lineitem name column.',
      columnsFound: ['Foo', 'Bar'],
    });
  });

  it('names the separator when a re-saved export comes back semicolon-delimited', () => {
    /* The likeliest false accusation: a genuine export opened and saved again
       in Excel under a European locale parses as one column and would
       otherwise be told it is not an order export at all. */
    const result = parseShopifyOrderExport('Name;Email;Lineitem name\n#A1;a@b.c;Falling Light');
    expect(result.fault?.kind).toBe('wrong_separator');
    expect(result.fault?.detail).toContain('comma-delimited');
  });

  it('separates an empty file from a header with no rows under it', () => {
    expect(parseShopifyOrderExport('').fault?.kind).toBe('empty');
    expect(parseShopifyOrderExport('Name,Lineitem name').fault?.kind).toBe('no_rows');
  });

  it('falls back to the email local part when no billing/shipping name exists', () => {
    const result = parseShopifyOrderExport(
      csv('#AA1007,zoe@example.com,paid,,unfulfilled,GBP,540,2026-05-19 10:00:00 +0100,1,Falling Light - Framed,540,FL-F,,'),
    );
    expect(result.items[0].collectorName).toBe('zoe');
  });
});

describe('splitLineItemTitle', () => {
  it('splits on the last " - "', () => {
    expect(splitLineItemTitle('Falling Light - Framed')).toEqual({
      title: 'Falling Light',
      variant: 'Framed',
    });
    expect(splitLineItemTitle('Study — Night - Blue - Unframed')).toEqual({
      title: 'Study — Night - Blue',
      variant: 'Unframed',
    });
  });

  it('returns an empty variant when there is no separator', () => {
    expect(splitLineItemTitle('Vessel VIII')).toEqual({ title: 'Vessel VIII', variant: '' });
  });
});

describe('filterItemsForRelease', () => {
  const items = parseShopifyOrderExport(
    csv(
      '#AA1010,a@example.com,paid,,unfulfilled,GBP,540,2026-05-20 10:00:00 +0100,1,Falling Light - Framed,540,FL-F,A A,A A',
      /* The lookalike that actually occurs: a second edition off the same
         image, sold as its own product with its own promise. A bare prefix
         match would sweep its collectors into the first release's plan. */
      '#AA1011,b@example.com,paid,,unfulfilled,GBP,90,2026-05-20 11:00:00 +0100,1,Falling Light Study - Framed,90,FL-S-F,B B,B B',
      '#AA1012,c@example.com,paid,,unfulfilled,GBP,1200,2026-05-20 12:00:00 +0100,1,Vessel VIII,1200,V8,C C,C C',
    ),
  ).items;

  it('matches exact titles and "Title - Variant" forms, not lookalike releases', () => {
    const { matched, filteredOut } = filterItemsForRelease(items, ['Falling Light']);
    expect(matched.map((i) => i.shopifyOrderName)).toEqual(['#AA1010']);
    expect(filteredOut).toBe(2);
  });

  it('matches variant-less titles exactly', () => {
    const { matched } = filterItemsForRelease(items, ['Vessel VIII']);
    expect(matched.map((i) => i.shopifyOrderName)).toEqual(['#AA1012']);
  });

  /* Inverted 30 Aug 2026. It used to pass everything through, which is safe
     only while the one caller always supplies a title — and the moment a
     release can exist with no confirmed product match, "match everything"
     welds another release's collectors into its plan. An empty claim is a
     claim on nothing. */
  it('claims nothing when there are no matchers', () => {
    const { matched, filteredOut } = filterItemsForRelease(items, []);
    expect(matched).toHaveLength(0);
    expect(filteredOut).toBe(3);
  });
});

describe('orderDedupeKey', () => {
  it('is case- and whitespace-insensitive', () => {
    expect(orderDedupeKey('#AA1001', 'Falling Light - Framed')).toBe(
      orderDedupeKey(' #aa1001 ', 'falling light - framed '),
    );
  });
});
