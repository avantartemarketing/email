import { addDays, today } from '../logic/dates';

/**
 * The tour's script: thirteen steps that drive the REAL app, end to end.
 *
 * The owner, 1 Sep 2026: an animated guide, "running end to end on how this
 * works", for new team members, inside the prototype, about two minutes.
 *
 * Nothing here is a recording. Every step performs the same clicks and
 * keystrokes a person would — the same doors, the same guards — so the guide
 * cannot drift from the product: if a button moves, the tour breaks in front
 * of whoever maintains it, not in front of the new starter. And because the
 * demo world is in-memory, everything the tour does (a reschedule, an
 * allocation) vanishes on refresh, which the last card says out loud.
 */

export interface TourStep {
  title: string;
  caption: string;
  /** What to spotlight. No target (or none found) draws a centred card. */
  target?: string;
  /** Drive the app into this step's state. Failures skip, never wedge. */
  go?: (navigate: (path: string) => void) => Promise<void>;
  /** Reading time before autoplay advances. */
  holdMs: number;
}

/* ---- DOM driving, the same way a person does it -------------------------- */

const frame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));

async function waitFor(selector: string, timeoutMs = 4000): Promise<Element | null> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const el = document.querySelector(selector);
    if (el) return el;
    await frame();
  }
  return null;
}

async function click(selector: string): Promise<void> {
  const el = await waitFor(selector);
  if (el instanceof HTMLElement) el.click();
}

async function clickText(selector: string, text: string): Promise<void> {
  const until = Date.now() + 4000;
  while (Date.now() < until) {
    const el = [...document.querySelectorAll(selector)].find((e) =>
      (e.textContent ?? '').includes(text),
    );
    /* A disabled control is a door a person cannot press either — keep
       waiting for it to open. ("Read the file" enables a beat after the drop
       label flips, once the file's text has actually been read.) */
    if (el instanceof HTMLElement && !(el as HTMLButtonElement).disabled) {
      el.click();
      return;
    }
    await frame();
  }
}

/** Wait until an element matching the selector says the text — the way to
    know a navigation or an async read has actually landed, because the OLD
    screen's table still matches any structural selector while the new one
    mounts. */
async function waitForText(selector: string, text: string, timeoutMs = 4000): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const hit = [...document.querySelectorAll(selector)].some((e) =>
      (e.textContent ?? '').includes(text),
    );
    if (hit) return;
    await frame();
  }
}

/** Set a React-controlled input's value so React actually hears it. */
async function type(selector: string, value: string): Promise<void> {
  const el = await waitFor(selector);
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return;
  const proto = el instanceof HTMLInputElement ? HTMLInputElement : HTMLTextAreaElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Hand the New release dialogue a file, exactly as a drop would. */
async function dropCsv(name: string, csv: string): Promise<void> {
  const input = await waitFor('.rd-importdrop input');
  if (!(input instanceof HTMLInputElement)) return;
  const transfer = new DataTransfer();
  transfer.items.add(new File([csv], name, { type: 'text/csv' }));
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

const settle = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/* ---- the sample export the tour drops ------------------------------------
   Harbour Lantern, not Harbour Light: the claim guard rightly refuses a file
   whose products a seeded release already owns, and the tour dropping one
   would demo the guard instead of the flow. Same real shape — the sales
   channel in the title, framing as its own line item, four-segment SKUs. */
const TOUR_HEADER =
  'Name,Email,Financial Status,Paid at,Fulfillment Status,Currency,Subtotal,Created at,' +
  'Lineitem quantity,Lineitem name,Lineitem price,Lineitem sku,Billing Name,Shipping Name,' +
  'Shipping Country,Tags';
const row = (n: number, title: string, sku: string): string =>
  `#TL9${n},tour${n}@example.com,paid,2026-06-01 10:0${n}:00 +0000,unfulfilled,GBP,620,` +
  `2026-06-01 10:0${n}:00 +0000,1,${title},620,${sku},Tour Collector ${n},Tour Collector ${n},United Kingdom,`;
const cont = (title: string, sku: string): string => `,,,,,,,,1,${title},620,${sku},,,,`;
export const TOUR_CSV = [
  TOUR_HEADER,
  row(1, 'Harbour Lantern (Dawn) - Public', 'RSTOL-LANTD-TL-PUBLIC'),
  cont('Harbour Lantern (Dawn) - Black Abachi wood frame - UV protective acrylic', 'RSTOL-LANTD-FR-BLACKABACH'),
  row(2, 'Harbour Lantern (Dawn) - Public', 'RSTOL-LANTD-TL-PUBLIC'),
  row(3, 'Harbour Lantern (Dusk) - Pre-order', 'RSTOL-LANTK-TL-PREORDER'),
].join('\n');

/* ---- the script ---------------------------------------------------------- */

export const TOUR_STEPS: TourStep[] = [
  {
    title: 'The post-purchase comms tool',
    caption:
      'Two minutes, end to end: a release arrives from Shopify, promises dates, sends emails, ' +
      'survives a delay, and numbers its editions for the warehouse. Everything you are about ' +
      'to see is the real app doing real work.',
    holdMs: 9000,
    go: async (navigate) => {
      navigate('/');
      await waitFor('table.rd-t27 tbody tr');
    },
  },
  {
    title: 'Releases',
    caption:
      'Every release in production. Orders, batches, what needs approval, and the next ' +
      'scheduled send — open a row to work a release.',
    target: 'table.rd-t27',
    holdMs: 8000,
    go: async (navigate) => {
      navigate('/');
      await waitFor('table.rd-t27 tbody tr');
    },
  },
  {
    title: 'A release starts from the file',
    caption:
      'Drop the Shopify order export and the file leads: it lists the artworks it contains, ' +
      'ticks what belongs, names the release, and finds the framed orders — a frame is its own ' +
      'line item, and the tool joins it to the print beside it. One press creates the release, ' +
      'its batches and every order.',
    target: '.rd-dialog',
    holdMs: 12000,
    go: async () => {
      await clickText('button', 'New release');
      await dropCsv('harbour-lantern-orders.csv', TOUR_CSV);
      /* The dialogue reads the dropped file asynchronously; "Read the file"
         stays shut until the drop label flips to "Replace …". */
      await waitForText('.rd-importdrop', 'Replace');
      await clickText('.rd-dialog button', 'Read the file');
      await waitFor('.rd-dialog .rd-importlist tbody tr');
    },
  },
  {
    title: 'All orders — one row per print',
    caption:
      'Everything the warehouse and CS need on one line: frame, glass, batch, promise date, ' +
      'and the order number links straight into Shopify. Select rows to cancel, move, or ' +
      'change a delivery date in bulk.',
    /* The container, not the table: All orders scrolls sideways, and the
       table's own rectangle is its scrollWidth — a spotlight the size of the
       screen, which is no spotlight at all. */
    target: '.rd-workscroll',
    holdMs: 9000,
    go: async (navigate) => {
      await click('.rd-dialogx');
      navigate('/');
      await clickText('table tbody tr', 'Harbour Light');
      await waitForText('.rd-title', 'Harbour Light');
      await waitFor('table.rd-t27 tbody tr');
    },
  },
  {
    title: 'Batches — two timelines',
    caption:
      'Framed and unframed ship on different dates, so each batch carries its own promise ' +
      'date, comms plan and history. A release that never splits shows one quiet Overview.',
    target: '.rd-workscroll .rd-card',
    holdMs: 8000,
    go: async () => {
      await clickText('.rd-tab', 'Batches');
      await settle(300);
    },
  },
  {
    title: 'All emails — the plan',
    caption:
      'The sequence each collector gets, planned back from the promise date: printing, ' +
      'signing, framing, on-track. Every email needs an image and an approval before it sends.',
    target: '.rd-workscroll .rd-card',
    holdMs: 8000,
    go: async () => {
      await clickText('.rd-tab', 'All emails');
      await settle(300);
    },
  },
  {
    title: 'A delay happens',
    caption:
      'Select the affected orders and change the delivery date. Picking part of a batch splits ' +
      'it onto its own timeline. The reason is not paperwork — it is the brief the CRM writer ' +
      'works from.',
    target: '.rd-dialog',
    holdMs: 11000,
    go: async (navigate) => {
      navigate('/');
      await clickText('table tbody tr', 'Falling Light');
      await waitForText('.rd-title', 'Falling Light');
      await waitFor('table.rd-t27 tbody tr');
      await click('table.rd-t27 tbody tr .rd-cbx');
      await clickText('button', 'Set a new promise date');
      await waitFor('.rd-dialog');
      await type('.rd-dialog input[type="date"]', addDays(today(), 38));
      await type(
        '.rd-dialog textarea',
        'Reprint needed — the framer found a mark on the border in final QC',
      );
    },
  },
  {
    title: 'Saved — and handed to CRM',
    caption:
      'One save: the batch splits, the milestone plan regenerates against the new date, and ' +
      'writing the delay email lands on the CRM team’s list. Nobody composes bad news in a ' +
      'hurry inside a date picker.',
    target: '.rd-toast',
    holdMs: 8000,
    go: async () => {
      await clickText('.rd-dialogfoot button', 'Save');
      await waitFor('.rd-toast', 6000);
    },
  },
  {
    title: 'Emails to write — the CRM queue',
    caption:
      'The job just created is here, newest at the top, with the delay reason beside it and a ' +
      'clock on how long it has waited. The writer works from the reason; approval follows.',
    target: 'table.rd-t27',
    holdMs: 8000,
    go: async (navigate) => {
      navigate('/copy');
      await waitFor('table.rd-t27 tbody tr');
    },
  },
  {
    title: 'My approvals',
    caption:
      'What needs approving now, and what is coming. An approver can approve, move the date, ' +
      'or cancel — there is no “hold”, because a held email is a decision nobody made.',
    target: 'table.rd-t27',
    holdMs: 7000,
    go: async (navigate) => {
      navigate('/approvals');
      await waitFor('table.rd-t27 tbody tr');
    },
  },
  {
    title: 'Edition allocation',
    caption:
      'The numbering the spreadsheet used to do. The rule is the studio’s own: collectors who ' +
      'bought the most artworks get the lowest numbers, oldest order first — and an order’s ' +
      'prints always share one number.',
    target: '.rd-workscroll .rd-card',
    holdMs: 9000,
    go: async (navigate) => {
      navigate('/');
      await clickText('table tbody tr', 'Harbour Light');
      await waitForText('.rd-title', 'Harbour Light');
      await clickText('.rd-tab', 'Edition allocation');
      await settle(400);
    },
  },
  {
    title: 'One press, every number',
    caption:
      'Allocated: gapless sequences per artwork, matched sets per collector — search #RS2134 in ' +
      'All orders, edition 1 of all three colourways. Export sends the warehouse the same CSV ' +
      'it has always received, and a number, once issued, never moves.',
    target: '.rd-workscroll .rd-card',
    holdMs: 10000,
    go: async () => {
      await clickText('button', 'Allocate editions');
      await settle(700);
    },
  },
  {
    title: 'That’s the loop',
    caption:
      'File in → promises made → emails approved and sent → delays briefed to CRM → editions ' +
      'numbered → CSV out. This is demo data: refresh resets everything the tour just did, and ' +
      'the tour lives in the rail whenever you want it again.',
    holdMs: 9000,
  },
];
