#!/usr/bin/env node
/**
 * Prove the HubSpot pipe — standalone, no UI, no app dependencies.
 *
 * Validates the one unknown that could force a redesign:
 *   1. the private app token and scopes work;
 *   2. a master marketing email (e.g. `pp-delay`) can be CLONED via the API;
 *   3. the clone's draft can be PATCHED (subject + `{{token}}` fields in the
 *      body content) and PUSHED LIVE;
 *   4. the account's transactional email add-on accepts a SINGLE-SEND of the
 *      published clone to a test recipient, returning a send ID.
 *
 * Usage:
 *   HUBSPOT_TOKEN=pat-... \
 *   HUBSPOT_MASTER_EMAIL=pp-delay \
 *   HUBSPOT_TEST_EMAIL=you@avantarte.com \
 *   node scripts/hubspot-pipe-test.mjs [--dry-run]
 *
 *   --dry-run  do everything except the final single-send.
 *
 * Required private app scopes: `content` (marketing email read/write) and
 * `transactional-email` (single-send). The master email should be created in
 * HubSpot as a Transactional email — single-send only accepts those.
 *
 * Exit codes: 0 = full pipe proven; 1 = a step failed (the output says which
 * step and what HubSpot returned, so scope/add-on gaps are unambiguous).
 */

const API = 'https://api.hubapi.com';
const TOKEN = process.env.HUBSPOT_TOKEN;
const MASTER_NAME = process.env.HUBSPOT_MASTER_EMAIL ?? 'pp-delay';
const TEST_EMAIL = process.env.HUBSPOT_TEST_EMAIL;
const DRY_RUN = process.argv.includes('--dry-run');

if (!TOKEN || !TEST_EMAIL) {
  console.error(
    'Missing env. Set HUBSPOT_TOKEN (private app token) and HUBSPOT_TEST_EMAIL (a test contact email).',
  );
  process.exit(1);
}

let step = 'init';

async function hubspot(method, path, body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error body */
  }
  if (!response.ok) {
    const detail = json?.message ?? text.slice(0, 500);
    throw new Error(`[${step}] ${method} ${path} → HTTP ${response.status}: ${detail}`);
  }
  return json;
}

/** Replace {{tokens}} in every string of the content tree — the same
 * patch the app will apply per send. */
function deepPatchTokens(value, fields) {
  if (typeof value === 'string') {
    return value.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (whole, token) => {
      const replacement = fields[token.toLowerCase()];
      return replacement !== undefined ? replacement : whole;
    });
  }
  if (Array.isArray(value)) return value.map((item) => deepPatchTokens(item, fields));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, inner] of Object.entries(value)) out[key] = deepPatchTokens(inner, fields);
    return out;
  }
  return value;
}

const FIELDS = {
  artist: 'Jenny Marlowe',
  release_title: 'Falling Light',
  promise_date: '20 November 2026',
  old_promise_date: '15 September 2026',
  reason_line: 'The second framing run has been pushed back at our framers.',
  // first_name is left for HubSpot contact personalisation tokens.
};

try {
  // -- Step 1: token works, master exists ---------------------------------
  step = '1/5 find master';
  const search = await hubspot(
    'GET',
    `/marketing/v3/emails?name=${encodeURIComponent(MASTER_NAME)}&limit=10`,
  );
  const master = (search.results ?? []).find((e) => e.name === MASTER_NAME);
  if (!master) {
    throw new Error(
      `[${step}] No marketing email named "${MASTER_NAME}" found. Create the master in HubSpot first (as a Transactional email).`,
    );
  }
  console.log(`✓ 1/5 master "${MASTER_NAME}" found (id ${master.id}, state ${master.state})`);

  // -- Step 2: clone ------------------------------------------------------
  step = '2/5 clone';
  const cloneName = `${MASTER_NAME}-pipe-test-${Date.now()}`;
  const clone = await hubspot('POST', '/marketing/v3/emails/clone', {
    id: master.id,
    cloneName,
  });
  console.log(`✓ 2/5 cloned to "${cloneName}" (id ${clone.id})`);

  // -- Step 3: patch the draft --------------------------------------------
  step = '3/5 patch draft';
  const draft = await hubspot('GET', `/marketing/v3/emails/${clone.id}/draft`);
  const patched = {
    subject: deepPatchTokens(draft.subject ?? '', FIELDS),
    content: deepPatchTokens(draft.content ?? {}, FIELDS),
  };
  await hubspot('PATCH', `/marketing/v3/emails/${clone.id}/draft`, patched);
  console.log(`✓ 3/5 draft patched (subject: "${patched.subject}")`);

  // -- Step 4: publish ----------------------------------------------------
  step = '4/5 publish';
  await hubspot('POST', `/marketing/v3/emails/${clone.id}/draft/push-live`);
  console.log('✓ 4/5 draft pushed live');

  // -- Step 5: transactional single-send ----------------------------------
  step = '5/5 single-send';
  if (DRY_RUN) {
    console.log('– 5/5 skipped (--dry-run). Remove the flag to prove the transactional add-on.');
  } else {
    const send = await hubspot('POST', '/marketing/v3/transactional/single-email/send', {
      emailId: Number(clone.id),
      message: { to: TEST_EMAIL },
      // customProperties flow into {{custom.*}} tokens if the template uses
      // them — the alternative to content patching for per-send fields.
      customProperties: { pipe_test: 'true' },
    });
    console.log(
      `✓ 5/5 single-send accepted — send id ${send.sendId ?? send.id ?? JSON.stringify(send)}`,
    );
    console.log(`  Check ${TEST_EMAIL} for the patched delay email.`);
  }

  console.log('\nPIPE PROVEN: clone → patch → publish → single-send all work with this token.');
  console.log(`Clean up: archive "${cloneName}" in HubSpot when done.`);
} catch (error) {
  console.error(`\n✗ ${error.message}`);
  if (/403|MISSING_SCOPES/i.test(String(error.message))) {
    console.error(
      '  → Looks like a scope/add-on problem. Needed: "content" scope for clone/patch/publish,\n' +
        '    "transactional-email" scope AND the transactional email add-on for single-send.',
    );
  }
  process.exit(1);
}
