import { addDays, today } from '../logic/dates';

/**
 * The tour's scripts: four guides, each driving the REAL app through one job.
 *
 * The owner, 1 Sep 2026: "split the Take a Tour into a few paths" — how to
 * import a release and get it to edition numbers; how to set up the email
 * plan; how to log a delay (whole batch and part of one) through to the
 * delay email; and how the named approver approves.
 *
 * Nothing here is a recording. Every step performs the same clicks and
 * keystrokes a person would — the same doors, the same guards — so the guide
 * cannot drift from the product: if a button moves, the tour breaks in front
 * of whoever maintains it, not in front of the new starter. And because the
 * demo world is in-memory, everything a guide does (a reschedule, an
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
    The index must be CURRENT before the row click: a guide often starts on
    the very release it is about to open, whose own tables also say the title
    — so the first wait is for the index's page title, not for any row. */
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

/* ---- the four guides -----------------------------------------------------
   The captions are STEP-BY-STEP INSTRUCTIONS in plain English. The owner,
   1 Sep 2026, on the first draft: "the tone of voice is awful … Do it in
   plain english, proper sentences, like you're explaining to a normal
   person", and "structure them as a step by step guide — here's how to
   import a release and get it to edition numbers." So every caption says
   what to click and what happens, and nothing else. */

export const TOUR_PATHS: TourPath[] = [
  {
    id: 'release',
    title: 'How to import a release and allocate edition numbers',
    blurb: 'From the Shopify order export to a numbered edition.',
    steps: [
      {
        title: 'Step 1 — Start on the Releases page',
        caption:
          'This is the list of every release. To bring in a new one, click New release in the ' +
          'top right. The tour will do it for you now.',
        target: 'table.rd-t27',
        holdMs: 7000,
        go: async (navigate) => {
          navigate('/');
          await waitFor('table.rd-t27 tbody tr');
        },
      },
      {
        title: 'Step 2 — Drop in the order export',
        caption:
          'Drop the Shopify order export into the box, or choose the file. The tool reads it, ' +
          'lists the products it found, suggests a name, and marks which lines are frames. ' +
          'Fill in the artist and edition size, then click Next — batches & dates.',
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
        title: 'Step 3 — Set the delivery dates',
        caption:
          'Each batch gets a promised delivery date, and the email plan is built from it. ' +
          'Set a date and the table below shows exactly which emails will be queued and how ' +
          'many images need picking — before the release exists. A date can be left blank ' +
          'and set later on the batch screen. Click Create release to finish.',
        target: '.rd-dialog',
        holdMs: 12000,
        go: async () => {
          await type('.rd-fieldrow input', 'Tour Artist');
          await clickText('.rd-dialog button', 'Next — batches');
          await waitForText('.rd-grouphd', 'What this will send');
          await type('.rd-dialog input[type="date"]', addDays(today(), 40));
          await settle(500);
        },
      },
      {
        title: 'Step 4 — Check the orders',
        caption:
          'Here is Harbour Light as an example. Every print is one row, showing its frame, ' +
          'glass, batch and promised delivery date. The order number links to Shopify. Use the ' +
          'checkboxes to cancel orders, move them, or change delivery dates in bulk.',
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
        title: 'Step 5 — Open the Edition allocation tab',
        caption:
          'This does the numbering the old spreadsheet did. The rule: collectors who bought ' +
          'the most artworks get the lowest numbers, framed orders come before unframed ones, ' +
          'and older orders come first. All the prints in one order always get the same number.',
        target: '.rd-workscroll .rd-card',
        holdMs: 9000,
        go: async () => {
          await clickText('.rd-tab', 'Edition allocation');
          await settle(400);
        },
      },
      {
        title: 'Step 6 — Click Allocate editions',
        caption:
          'Every order now has its edition number, with no gaps in any sequence. Click Export ' +
          'warehouse CSV to download the same file the warehouse has always worked from. Once ' +
          'a number has been issued it never changes.',
        target: '.rd-workscroll .rd-card',
        holdMs: 10000,
        go: async () => {
          await clickText('button', 'Allocate editions');
          await settle(700);
        },
      },
      {
        title: 'Done',
        caption:
          'That is the whole job: import the file, check the orders, allocate, export. This is ' +
          'demo data — refresh the page to reset anything the tour changed.',
        holdMs: 7000,
      },
    ],
  },
  {
    id: 'emails',
    title: 'How to set up the email plan for a release',
    blurb: 'Pick the images and review what each batch will send.',
    steps: [
      {
        title: 'Step 1 — Open the All emails tab',
        caption:
          'When a release is created, the tool plans its emails automatically, working back ' +
          'from the promised delivery date: printing, signing, framing, on track. This tab ' +
          'lists them all. Your job is to fill the gaps and approve.',
        target: '.rd-workscroll .rd-card',
        holdMs: 9000,
        go: async (navigate) => {
          await openRelease(navigate, 'Harbour Light');
          await clickText('.rd-tab', 'All emails');
          await settle(300);
        },
      },
      {
        title: 'Step 2 — Add the missing images',
        caption:
          'An email cannot be approved until it has an image, and there is no default. Click ' +
          'any slot marked Not chosen to pick one.',
        target: '.rd-dialog',
        holdMs: 8000,
        go: async () => {
          await click('button.rd-ctag-none');
          await waitFor('.rd-dialog .rd-imgtile');
        },
      },
      {
        title: 'Step 3 — Pick an image',
        caption:
          'One click fills the slot. The striped tiles are images that live in HubSpot, so ' +
          'there is no preview here; anything you upload yourself shows its picture. Do the ' +
          'same for each empty slot and the release is ready to approve.',
        target: '.rd-workscroll .rd-card',
        holdMs: 8000,
        go: async () => {
          await click('.rd-dialog .rd-imgtile');
          await settle(400);
        },
      },
      {
        title: 'Step 4 — Review each batch’s plan',
        caption:
          'Framed and unframed orders ship at different times, so each batch has its own ' +
          'promise date and its own emails. Open the Batches tab to check a batch’s plan and ' +
          'history before anything goes out.',
        target: '.rd-workscroll .rd-card',
        holdMs: 9000,
        go: async () => {
          await clickText('.rd-tab', 'Batches');
          await settle(400);
        },
      },
      {
        title: 'Done',
        caption:
          'The tool writes the plan; you pick the images, adjust any copy, and approve. ' +
          'Refresh the page to reset the demo.',
        holdMs: 7000,
      },
    ],
  },
  {
    id: 'delay',
    title: 'How to log a delay',
    blurb: 'Move a whole batch or just a few orders, then write the delay email.',
    steps: [
      {
        title: 'Step 1 — Open the batch that is slipping',
        caption:
          'Here are Falling Light’s batches. A delivery promise belongs to a batch, so a ' +
          'delay starts on the batch’s own screen.',
        target: '.rd-workscroll .rd-card',
        holdMs: 8000,
        go: async (navigate) => {
          await openRelease(navigate, 'Falling Light');
          await clickText('.rd-tab', 'Batches');
          await settle(400);
        },
      },
      {
        title: 'Step 2 — Change the delivery date',
        caption:
          'With no orders selected, Change delivery date moves the whole batch. Pick the new ' +
          'date and explain what happened — the CRM team writes the delay email from what you ' +
          'type here, so give them the real reason.',
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
        title: 'Step 3 — Save',
        caption:
          'Saving does three things: it sets the new date, rebuilds the email plan around it, ' +
          'and adds a writing job to the CRM team’s list.',
        target: '.rd-toast',
        holdMs: 8000,
        go: async () => {
          await clickText('.rd-dialogfoot button', 'Save');
          await waitFor('.rd-toast', 6000);
        },
      },
      {
        title: 'Step 4 — Or delay just some orders',
        caption:
          'If only a few orders are affected, tick them on All orders and click Change delivery ' +
          'date. Those orders split off into their own batch, with their own date and ' +
          'their own emails. The rest of the batch keeps the original plan.',
        target: '.rd-dialog',
        holdMs: 10000,
        go: async () => {
          await clickText('.rd-tab', 'All orders');
          await waitFor('table.rd-t27 tbody tr');
          await click('table.rd-t27 tbody tr .rd-cbx');
          await clickText('.rd-bulkbar button', 'Change delivery date');
          await waitFor('.rd-dialog');
          await type('.rd-dialog input[type="date"]', addDays(today(), 45));
          await type(
            '.rd-dialog textarea',
            'Reprint needed — the framer found a mark on the border in final QC',
          );
        },
      },
      {
        title: 'Step 5 — Save the split',
        caption:
          'A new batch now holds just the delayed orders, and a second delay email has joined ' +
          'the CRM list.',
        target: '.rd-toast',
        holdMs: 7000,
        go: async () => {
          await clickText('.rd-dialogfoot button', 'Save');
          await waitFor('.rd-toast', 6000);
        },
      },
      {
        title: 'Step 6 — Open Emails to write',
        caption:
          'This is the CRM team’s list. Both delay emails are here, newest first, each with ' +
          'its reason and how long collectors have been waiting to hear.',
        target: 'table.rd-t27',
        holdMs: 8000,
        go: async (navigate) => {
          navigate('/copy');
          await waitFor('table.rd-t27 tbody tr');
          await settle(300);
        },
      },
      {
        title: 'Step 7 — Write the delay email',
        caption:
          'Click a row to open it. The reason you typed sits above the fields, and there is a ' +
          'drafted email to start from. Edit the subject and body, then click Send for ' +
          'approval.',
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
        title: 'Done',
        caption:
          'The date has moved, the plan is rebuilt, and the delay email is waiting for ' +
          'approval — the next guide covers that step. Refresh the page to reset the demo.',
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
    title: 'How to approve emails',
    blurb: 'What the named approver sees and does when an email is due.',
    steps: [
      {
        title: 'Step 1 — Open My approvals',
        caption:
          'This shows what needs approving in the next seven days, and what is coming after ' +
          'that. Each release names its approver — that is set on the release page, and right ' +
          'now it is Elani for everything.',
        target: 'table.rd-t27',
        holdMs: 9000,
        go: async (navigate) => {
          navigate('/approvals');
          await waitFor('table.rd-t27 tbody tr');
        },
      },
      {
        title: 'Step 2 — Work as the approver',
        caption:
          'The tour has switched to Elani using the name at the top right. On her releases the ' +
          'Approver column now reads You. If she is away, any admin can approve in her place.',
        target: 'table.rd-t27',
        holdMs: 8000,
        go: async () => {
          await click('button.rd-who');
          await clickText('.rd-float button[role="menuitem"]', 'Elani');
          await settle(400);
        },
      },
      {
        title: 'Step 3 — Approve',
        caption:
          'One click approves the email and queues it for its scheduled day. An email without ' +
          'an image cannot be approved — its button is disabled and says why. To move or ' +
          'cancel sends instead, tick their checkboxes and use the bar that appears.',
        target: '.rd-toast',
        holdMs: 9000,
        go: async () => {
          await clickText('.rd-rowacts button', 'Approve');
          await waitFor('.rd-toast', 6000);
        },
      },
      {
        title: 'Done',
        caption:
          'You are still signed in as Elani — switch back using the name at the top right. ' +
          'Refresh the page to reset the demo.',
        holdMs: 7000,
      },
    ],
  },
];
