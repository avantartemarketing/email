import { describe, expect, it } from 'vitest';
import type { Release } from '../../types';
import {
  buildNextSteps,
  buildTemplateFields,
  effectiveTemplate,
  imageSlotsForPlan,
  missingOnTrackImages,
  onTrackSlotsFor,
  onTrackSlotsNeeded,
  patchTokens,
  releaseSequenceFor,
  renderForRecipient,
  renderReleaseTemplate,
  renderTemplate,
  sequenceForBatch,
  shipWindowShort,
  shipWindowText,
} from '../templates';

function makeRelease(overrides: Partial<Release> = {}): Release {
  return {
    id: 'rel-1',
    title: 'Falling Light',
    artist: 'Jenny Marlowe',
    shopifyProductIds: [],
    editionSize: 150,
    status: 'active',
    productKind: 'print',
    disabledTemplates: [],
    templateOverrides: {},
    templateImages: {},
    createdAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('patchTokens', () => {
  it('replaces known tokens and leaves unknown ones intact', () => {
    const out = patchTokens('Hi {{first_name}}, {{release_title}} by {{artist}}', {
      release_title: 'Falling Light',
      artist: 'Jenny Marlowe',
    });
    expect(out).toBe('Hi {{first_name}}, Falling Light by Jenny Marlowe');
  });

  it('tolerates whitespace inside braces', () => {
    expect(patchTokens('{{ artist }}', { artist: 'X' })).toBe('X');
  });
});

describe('ship window', () => {
  it('opens on the promise date and runs a week', () => {
    expect(shipWindowText('2026-10-30')).toBe('30 October 2026 and 6 November 2026');
  });

  it('is part of the standard field set', () => {
    const fields = buildTemplateFields(makeRelease(), '2026-10-30');
    expect(fields.ship_window).toBe('30 October 2026 and 6 November 2026');
    expect(fields.promise_date).toBe('30 October 2026');
    expect(fields.artist).toBe('Jenny Marlowe');
  });
});

describe('renderTemplate', () => {
  it('renders subject, headline and body with patched fields', () => {
    const { subject, headline, body } = renderTemplate('pp-delay', {
      artist: 'Jenny Marlowe',
      release_title: 'Falling Light',
      ship_window: '30 October 2026 and 6 November 2026',
      old_promise_date: '12 September 2026',
      reason_line: 'The framing run failed quality checks.',
    });
    expect(subject).toBe('An update on your Falling Light delivery date');
    expect(headline).toBe('An update on your order');
    expect(body).toContain('The framing run failed quality checks.');
    expect(body).toContain('previously expected to ship from 12 September 2026');
    expect(body).toContain('between 30 October 2026 and 6 November 2026');
    expect(body).toContain('{{first_name}}'); // survives until per-recipient render
  });

  it('milestone bodies carry the ship window, matching the real email format', () => {
    const fields = buildTemplateFields(makeRelease(), '2026-10-30');
    const { body } = renderTemplate('pp-printing', fields);
    expect(body).toContain('ship your edition between 30 October 2026 and 6 November 2026');
  });
});

describe('release-level overrides', () => {
  const release = makeRelease({
    templateOverrides: {
      'pp-printing': { headline: 'Now printing', body: 'Custom body for {{release_title}}.' },
    },
  });

  it('effectiveTemplate merges override fields over the master', () => {
    const template = effectiveTemplate(release, 'pp-printing');
    expect(template.headline).toBe('Now printing');
    expect(template.body).toBe('Custom body for {{release_title}}.');
    // Unspecified fields fall back to the master.
    expect(template.subject).toBe('{{artist}} · Printing in progress');
  });

  it('renderReleaseTemplate patches tokens into the override copy', () => {
    const { body } = renderReleaseTemplate(release, 'pp-printing', {
      release_title: 'Falling Light',
    });
    expect(body).toBe('Custom body for Falling Light.');
  });

  it('untouched templates render from the master', () => {
    const { headline } = renderReleaseTemplate(release, 'pp-signing', {});
    expect(headline).toBe('Signing in progress');
  });
});

describe('releaseSequenceFor', () => {
  it('returns the full print sequence by default', () => {
    expect(releaseSequenceFor(makeRelease())).toEqual([
      'pp-printing',
      'pp-signing',
      'pp-framing',
      'pp-dispatch',
    ]);
  });

  it('drops release-disabled milestones', () => {
    const release = makeRelease({ disabledTemplates: ['pp-framing'] });
    expect(releaseSequenceFor(release)).toEqual(['pp-printing', 'pp-signing', 'pp-dispatch']);
  });

  it('never drops dispatch, even if listed as disabled', () => {
    const release = makeRelease({ disabledTemplates: ['pp-dispatch'] });
    expect(releaseSequenceFor(release)).toContain('pp-dispatch');
  });
});

describe('sequenceForBatch', () => {
  it('unframed batches skip the framing email; framed keep it', () => {
    const release = makeRelease();
    expect(sequenceForBatch(release, { fulfilment: 'unframed' })).toEqual([
      'pp-printing',
      'pp-signing',
      'pp-dispatch',
    ]);
    expect(sequenceForBatch(release, { fulfilment: 'framed' })).toEqual([
      'pp-printing',
      'pp-signing',
      'pp-framing',
      'pp-dispatch',
    ]);
    expect(sequenceForBatch(release, {})).toEqual(releaseSequenceFor(release));
  });
});

describe('shipWindowShort', () => {
  it('says the month once when both ends share it', () => {
    expect(shipWindowShort('2026-09-17')).toBe('17 – 24 Sept 2026');
  });

  it('says both months when the window crosses one', () => {
    expect(shipWindowShort('2026-09-28')).toBe('28 Sept – 5 Oct 2026');
  });

  it('says both years when the window crosses one', () => {
    expect(shipWindowShort('2026-12-29')).toBe('29 Dec 2026 – 5 Jan 2027');
  });
});

describe('onTrackSlotsNeeded / missingOnTrackImages', () => {
  const release = makeRelease();

  it('sizes the slots to the LONGEST window, not the first or the shortest', () => {
    const short = onTrackSlotsNeeded(release, [{ promiseDate: '2026-07-01' }], '2026-06-01');
    const long = onTrackSlotsNeeded(release, [{ promiseDate: '2027-06-01' }], '2026-06-01');
    expect(long).toBeGreaterThan(short);
    // Both batches at once must come out as the longer of the two.
    expect(
      onTrackSlotsNeeded(
        release,
        [{ promiseDate: '2026-07-01' }, { promiseDate: '2027-06-01' }],
        '2026-06-01',
      ),
    ).toBe(long);
  });

  it('always offers at least one, so a release with no dates can still be set up', () => {
    expect(onTrackSlotsNeeded(release, [], '2026-06-01')).toBe(1);
    expect(onTrackSlotsNeeded(release, [{ promiseDate: null }], '2026-06-01')).toBe(1);
  });

  it('names the slots a longer date needs and nobody has picked an image for', () => {
    const withOne = { ...release, templateImages: { 'pp-ontrack-1': 'Artist portrait' } };
    const missing = missingOnTrackImages(withOne, [{ promiseDate: '2027-06-01' }], '2026-06-01');
    expect(missing).not.toContain('pp-ontrack-1');
    expect(missing.length).toBe(
      onTrackSlotsNeeded(withOne, [{ promiseDate: '2027-06-01' }], '2026-06-01') - 1,
    );
  });

  it('goes quiet once every slot has an image', () => {
    const slots = onTrackSlotsFor(release, [{ promiseDate: '2027-06-01' }], '2026-06-01');
    const filled = {
      ...release,
      templateImages: Object.fromEntries(slots.map((s, i) => [s, `Picture ${i + 1}`])),
    };
    expect(missingOnTrackImages(filled, [{ promiseDate: '2027-06-01' }], '2026-06-01')).toEqual([]);
  });
});

describe('imageSlotsForPlan', () => {
  /* It used to cycle three slots round, so a five-filler plan showed a
     collector the same picture twice. There are now as many slots as the
     longest window needs, and the nth filler takes the nth slot. */
  it('gives milestones their own slot and every on-track filler its own', () => {
    expect(
      imageSlotsForPlan([
        'pp-printing',
        'pp-ontrack',
        'pp-ontrack',
        'pp-ontrack',
        'pp-ontrack',
        'pp-dispatch',
      ]),
    ).toEqual([
      'pp-printing',
      'pp-ontrack-1',
      'pp-ontrack-2',
      'pp-ontrack-3',
      'pp-ontrack-4',
      'pp-dispatch',
    ]);
  });
});

describe('buildNextSteps', () => {
  it('builds one row per upcoming milestone with dates patched in', () => {
    const fields = buildTemplateFields(makeRelease(), '2026-10-30');
    const steps = buildNextSteps(['pp-signing', 'pp-framing', 'pp-dispatch'], fields);
    expect(steps.map((s) => s.title)).toEqual(['Signing', 'Framing', 'Dispatching']);
    expect(steps[2].text).toContain('between 30 October 2026 and 6 November 2026');
  });

  it('skips templates with no step copy (fillers, delay)', () => {
    const steps = buildNextSteps(['pp-ontrack', 'pp-dispatch'], {});
    expect(steps.map((s) => s.templateRef)).toEqual(['pp-dispatch']);
  });
});

describe('renderForRecipient', () => {
  it('uses the collector first name', () => {
    expect(renderForRecipient('Hi {{first_name}},', 'Jane Smith')).toBe('Hi Jane,');
  });

  it('greets comma-form names by the given name, not the surname', () => {
    expect(renderForRecipient('Hi {{first_name}},', 'Okafor, Chidi')).toBe('Hi Chidi,');
    expect(renderForRecipient('Hi {{first_name}},', 'Jiménez, Clara')).toBe('Hi Clara,');
  });

  it('survives a trailing comma with nothing after it', () => {
    expect(renderForRecipient('Hi {{first_name}},', 'Smith,')).toBe('Hi Smith,');
  });

  it('falls back gracefully for empty names', () => {
    expect(renderForRecipient('Hi {{first_name}},', '  ')).toBe('Hi there,');
  });
});
