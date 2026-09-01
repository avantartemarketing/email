import { addDays, today } from '../logic/dates';

/**
 * The tour's scripts: four PATHS, each driving the REAL app through one job.
 *
 * The owner, 1 Sep 2026: "split the Take a Tour into a few paths" — uploading
 * a release and allocating editions; populating the emails and reviewing each
 * batch's plan; logging a delay for a whole batch AND for part of one, all
 * the way to the delay email being written; and an email falling due with the
 * named approver approving it.
 *
 * Nothing here is a recording. Every step performs the same clicks and
 * keystrokes a person would — the same doors, the same guards — so the guide
 * cannot drift from the product: if a button moves, the tour breaks in front
 * of whoever maintains it, not in front of the new starter. And because the
 * demo world is in-memory, everything a path does (a reschedule, an
 * allocation, an approval) vanishes on refresh, which the closing cards say
 * out loud.
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

export interface TourPath {
  id: string;
  title: string;
  /** One line under the title on the chooser. */
  blurb: string;
  steps: TourStep[];
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

/** Open a release from the index and wait until its page has really landed.
    The index must be CURRENT before the row click: a path often starts on the
    very release it is about to open, whose own tables also say the title —
    so the first wait is for the index's page title, not for any row. */
async function openRelease(navigate: (path: string) => void, title: string): Promise<void> {
  navigate('/');
  await waitForText('.rd-title', 'Releases');
  await clickText('table tbody tr', title);
  await waitForText('.rd-title', title);
  await waitFor('table.rd-t27 tbody tr');
}

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

/* ---- the four paths ------------------------------------------------------ */

export const TOUR_PATHS: TourPath[] = [
  {
    id: 'release',
    title: 'A release, from file to numbered editions',
    blurb: 'Drop the Shopify export, get orders and batches, then allocate every edition number.',
    steps: [
      {
        title: 'Releases',
        caption:
          'Every release in production. Orders, batches, what needs approval, and the next ' +
          'scheduled send — open a row to work a release.',
        target: 'table.rd-t27',
        holdMs: 7000,
        go: async (navigate) => {
          navigate('/');
          await waitFor('table.rd-t27 tbody tr');
        },
      },
      {
        title: 'A release starts from the file',
        caption:
          'Drop the Shopify order export and the file leads: it lists the artworks it contains, ' +
          'ticks what belongs, names the release, and finds the framed orders — a frame is its ' +
          'own line item, and the tool joins it to the print beside it. One press creates the ' +
          'release, its batches and every order.',
        target: '.rd-dialog',
        holdMs: 12000,
        go: async () => {
          await clickText('button', 'New release');
          await dropCsv('harbour-lantern-orders.csv', TOUR_CSV);
          /* The dialogue reads the dropped file asynchronously; "Read the
             file" stays shut until the drop label flips to "Replace …". */
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
           table's own rectangle is its scrollWidth — a spotlight the size of
           the screen, which is no spotlight at all. */
        target: '.rd-workscroll',
        holdMs: 8000,
        go: async (navigate) => {
          await click('.rd-dialogx');
          await openRelease(navigate, 'Harbour Light');
        },
      },
      {
        title: 'Edition allocation',
        caption:
          'The numbering the spreadsheet used to do. The rule is the studio’s own: the most ' +
          'artworks first, framed before unframed, oldest order first — and an order’s prints ' +
          'always share one number.',
        target: '.rd-workscroll .rd-card',
        holdMs: 9000,
        go: async () => {
          await clickText('.rd-tab', 'Edition allocation');
          await settle(400);
        },
      },
      {
        title: 'One press, every number',
        caption:
          'Allocated: gapless sequences per artwork, matched sets per collector — search #RS2134 ' +
          'in All orders, edition 1 of all three colourways. Export sends the warehouse the same ' +
          'CSV it has always received, and a number, once issued, never moves.',
        target: '.rd-workscroll .rd-card',
        holdMs: 10000,
        go: async () => {
          await clickText('button', 'Allocate editions');
          await settle(700);
        },
      },
      {
        title: 'That’s the release path',
        caption:
          'File in, orders and batches out, editions numbered, CSV ready. This is demo data — ' +
          'refresh resets everything this path just did.',
        holdMs: 7000,
      },
    ],
  },
  {
    id: 'emails',
    title: 'The emails and each batch’s plan',
    blurb: 'Populate the emails, then read the plan the tool wrote against each batch.',
    steps: [
      {
        title: 'All emails — the plan',
        caption:
          'The sequence each collector gets, planned back from the promise date: printing, ' +
          'signing, framing, on-track. The tool wrote this plan when the release arrived; ' +
          'people approve it, email by email.',
        target: '.rd-workscroll .rd-card',
        holdMs: 9000,
        go: async (navigate) => {
          await openRelease(navigate, 'Harbour Light');
          await clickText('.rd-tab', 'All emails');
          await settle(300);
        },
      },
      {
        title: 'Every email needs an image',
        caption:
          'There is no default picture — an email cannot be approved until its image is picked. ' +
          'The dashed slots are the gaps; this is the populating.',
        target: '.rd-dialog',
        holdMs: 8000,
        go: async () => {
          await click('button.rd-ctag-none');
          await waitFor('.rd-dialog .rd-imgtile');
        },
      },
      {
        title: 'Picked',
        caption:
          'One press fills the slot. Hatched tiles are names living in HubSpot’s own library; ' +
          'anything uploaded here shows its picture. Do this for each empty slot and the ' +
          'release is approvable.',
        target: '.rd-workscroll .rd-card',
        holdMs: 8000,
        go: async () => {
          await click('.rd-dialog .rd-imgtile');
          await settle(400);
        },
      },
      {
        title: 'Each batch carries its own plan',
        caption:
          'Framed and unframed ship on different dates, so each batch has its own promise date, ' +
          'its own milestone emails and its own history. Review a batch here before its sends ' +
          'start going out.',
        target: '.rd-workscroll .rd-card',
        holdMs: 9000,
        go: async () => {
          await clickText('.rd-tab', 'Batches');
          await settle(400);
        },
      },
      {
        title: 'That’s the email path',
        caption:
          'The plan is written by the tool and reviewed by people: images picked, copy edited ' +
          'where needed, approvals last. Refresh resets what this path changed.',
        holdMs: 7000,
      },
    ],
  },
  {
    id: 'delay',
    title: 'A delay, whole batch and partial',
    blurb: 'Move a whole batch, split part of one, and follow the delay email to the CRM writer.',
    steps: [
      {
        title: 'A delay happens',
        caption:
          'Falling Light’s framed batch is slipping. A promise date belongs to a batch, so the ' +
          'move starts from the batch’s own screen.',
        target: '.rd-workscroll .rd-card',
        holdMs: 8000,
        go: async (navigate) => {
          await openRelease(navigate, 'Falling Light');
          await clickText('.rd-tab', 'Batches');
          await settle(400);
        },
      },
      {
        title: 'The whole batch moves',
        caption:
          'No orders selected means the whole batch: every collector in it gets the new date, ' +
          'the milestone plan regenerates behind it, and the reason is not paperwork — it is ' +
          'the brief the CRM writer works from.',
        target: '.rd-dialog',
        holdMs: 10000,
        go: async () => {
          await clickText('button', 'Change delivery date');
          await waitFor('.rd-dialog');
          await type('.rd-dialog input[type="date"]', addDays(today(), 31));
          await type(
            '.rd-dialog textarea',
            'Framing run pushed back a fortnight at the framers',
          );
        },
      },
      {
        title: 'Saved — and handed to CRM',
        caption:
          'One save: the plan regenerates against the new date and writing the delay email ' +
          'lands on the CRM team’s list. Nobody composes bad news in a hurry inside a date ' +
          'picker.',
        target: '.rd-toast',
        holdMs: 8000,
        go: async () => {
          await clickText('.rd-dialogfoot button', 'Save');
          await waitFor('.rd-toast', 6000);
        },
      },
      {
        title: 'Or just part of a batch',
        caption:
          'Two framed orders need a reprint; the rest are fine. Ticking rows and changing ' +
          'their date splits them onto their own timeline — their own promise, their own ' +
          'emails — and the rest of the batch keeps the plan it had.',
        target: '.rd-dialog',
        holdMs: 10000,
        go: async () => {
          await clickText('.rd-tab', 'All orders');
          await waitFor('table.rd-t27 tbody tr');
          await click('table.rd-t27 tbody tr .rd-cbx');
          await clickText('button', 'Set a new promise date');
          await waitFor('.rd-dialog');
          await type('.rd-dialog input[type="date"]', addDays(today(), 45));
          await type(
            '.rd-dialog textarea',
            'Reprint needed — the framer found a mark on the border in final QC',
          );
        },
      },
      {
        title: 'The split',
        caption:
          'A new batch exists now, carrying just the delayed orders, and a second delay email ' +
          'joins the CRM list. Splitting is how part of a promise changes without touching ' +
          'the rest.',
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
          'Both delays are here, newest at the top, each carrying its reason and a clock on how ' +
          'long collectors have waited to hear. The writer opens a row and works from the brief.',
        target: 'table.rd-t27',
        holdMs: 8000,
        go: async (navigate) => {
          navigate('/copy');
          await waitFor('table.rd-t27 tbody tr');
          await settle(300);
        },
      },
      {
        title: 'Writing the delay email',
        caption:
          'The reason sits above the fields; the drafted body is a starting point, not a ' +
          'sentence. Send for approval is the handoff back — the email joins the approver’s ' +
          'list and the recalibrated plan carries on behind it.',
        target: '.rd-dialog',
        holdMs: 11000,
        go: async () => {
          await click('table.rd-t27 tbody tr');
          await waitFor('.rd-dialog textarea');
          await type('.rd-dialog .rd-fields input', 'An update on your Falling Light delivery date');
          await type(
            '.rd-dialog textarea',
            'We’re sorry to share that your delivery date has moved. The framing run was ' +
              'pushed back at the framers, and we would rather take the extra days than rush ' +
              'the finish. Your new dispatch window is below — and your print is otherwise ' +
              'ready and waiting.',
          );
          await settle(300);
        },
      },
      {
        title: 'That’s the delay path',
        caption:
          'Date moved, plan recalibrated, email written and sent for approval — press it ' +
          'yourself, or take the Approval day path next. Refresh resets everything this ' +
          'path did.',
        holdMs: 8000,
        go: async () => {
          await clickText('.rd-dialogfoot button', 'Send for approval');
          await waitFor('.rd-toast', 6000);
        },
      },
    ],
  },
  {
    id: 'approval',
    title: 'Approval day',
    blurb: 'An email falls due, and the release’s named approver clears it.',
    steps: [
      {
        title: 'My approvals',
        caption:
          'What needs approving this week, and what is coming. Every release names its ' +
          'approver — set on the release page, Elani for every one right now — and the ' +
          'Approver column says whose list each send sits on.',
        target: 'table.rd-t27',
        holdMs: 9000,
        go: async (navigate) => {
          navigate('/approvals');
          await waitFor('table.rd-t27 tbody tr');
        },
      },
      {
        title: 'The named approver signs in',
        caption:
          'Working as Elani now. Naming is not gating — any admin can cover a holiday — but ' +
          'the name says who is expected to clear the list, and the rows now read “You”.',
        target: 'table.rd-t27',
        holdMs: 8000,
        go: async () => {
          await click('button.rd-who');
          await clickText('.rd-float button[role="menuitem"]', 'Elani');
          await settle(400);
        },
      },
      {
        title: 'Approve',
        caption:
          'One press queues the send for its date. An email with no image cannot be approved — ' +
          'its button is shut and says why — and there is no “hold”, because a held email is a ' +
          'decision nobody made.',
        target: '.rd-toast',
        holdMs: 9000,
        go: async () => {
          await clickText('.rd-rowacts button', 'Approve');
          await waitFor('.rd-toast', 6000);
        },
      },
      {
        title: 'That’s the approval path',
        caption:
          'You are still working as Elani — switch back from the chip up top. This is demo ' +
          'data: refresh resets the approval and everything else the tour did.',
        holdMs: 7000,
      },
    ],
  },
];
