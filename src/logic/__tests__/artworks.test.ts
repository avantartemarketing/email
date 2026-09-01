import { describe, expect, it } from 'vitest';
import { parseShopifyOrderExport } from '../importer';
import { productsInFile, proposeRelease } from '../intake';
import { artistCodeOf, artworksInFile, proposeArtworks, releaseTitleFor } from '../artworks';
import { FALLING_LIGHT_CSV, HARBOUR_LIGHT_CSV, VESSEL_VIII_CSV } from '../../data/mock/fixtures';

const real = productsInFile(parseShopifyOrderExport(HARBOUR_LIGHT_CSV).items);
const invented = productsInFile(parseShopifyOrderExport(FALLING_LIGHT_CSV).items);
const sculpture = productsInFile(parseShopifyOrderExport(VESSEL_VIII_CSV).items);

describe('grouping a file into artworks', () => {
  it('groups on the SKU art code, not on the title', () => {
    /* Three colourways, each with its own frames. Nine line-item titles become
       three artworks — which is the concept the tool was missing, and the one
       the whole edition-allocation workbook turns on. */
    const arts = artworksInFile(real);
    expect(arts.map((a) => a.name)).toEqual([
      'Harbour Light (Dawn)',
      'Harbour Light (Dusk)',
      'Harbour Light (Tide)',
      'Night Garden',
    ]);
    expect(arts.map((a) => a.key)).toEqual([
      'RSTON-HARBD',
      'RSTON-HARBK',
      'RSTON-HARBT',
      'RSTON-NIGHT',
    ]);
  });

  it('folds a frame into the artwork it frames, never a new one', () => {
    const dawn = artworksInFile(real).find((a) => a.name === 'Harbour Light (Dawn)')!;
    expect(dawn.printLines).toBeGreaterThan(0);
    expect(dawn.frameLines).toBeGreaterThan(0);
    expect(dawn.lineItemTitles).toContain(
      'Harbour Light (Dawn) - Black Abachi wood frame - UV protective acrylic',
    );
  });

  it('names an artwork from its print lines, not from a frame', () => {
    /* Naming from any line would call the artwork "Harbour Light (Dawn) -
       Black Abachi wood frame" whenever a frame sorted first. */
    for (const a of artworksInFile(real)) {
      if (a.printLines > 0) expect(a.name).not.toMatch(/frame/i);
    }
  });

  it('reads the artist from the SKU, and refuses to guess without one', () => {
    expect(artistCodeOf('AWEI1-GUARP-FR-WHITERAMIN')).toBe('AWEI1');
    expect(artistCodeOf('FL-FR')).toBeNull();
    expect(artistCodeOf(null)).toBeNull();
    // No SKU shape in the older fixture, so no artist is claimed.
    expect(artworksInFile(invented).every((a) => a.artistCode === null)).toBe(true);
  });

  it('still groups a file with no SKU column, by product key', () => {
    const arts = artworksInFile(invented);
    expect(arts.map((a) => a.name).sort()).toEqual(['Falling Light', 'Night Garden']);
  });
});

describe('what gets proposed', () => {
  it('proposes the lead artwork’s artist, and drops the hitchhikers', () => {
    /* A per-release export contains WHOLE orders, so other releases ride along.
       Measured on the real Guardian file: 1,067 print lines under AWEI1 in
       three artworks, plus two stray JALBE lines and one ANTON line. */
    const proposed = proposeArtworks(artworksInFile(real));
    expect(proposed.map((a) => a.name)).toEqual([
      'Harbour Light (Dawn)',
      'Harbour Light (Dusk)',
      'Harbour Light (Tide)',
    ]);
  });

  it('never proposes an artwork that has no print', () => {
    /* #RS2107 is a frame whose print is in another release's export. It is a
       stray, not an artwork of this release — and proposing it also left the
       release with no derivable title, because it shares no prefix. */
    const arts = artworksInFile(real);
    expect(arts.some((a) => a.name === 'Night Garden' && a.printLines === 0)).toBe(true);
    expect(proposeArtworks(arts).map((a) => a.name)).not.toContain('Night Garden');
  });

  it('proposes only the lead when the file states no artist', () => {
    expect(proposeArtworks(artworksInFile(invented)).map((a) => a.name)).toEqual(['Falling Light']);
  });
});

describe('naming the release', () => {
  it('names a multi-artwork release by what its artworks share', () => {
    expect(releaseTitleFor(proposeArtworks(artworksInFile(real)))).toBe('Harbour Light');
  });

  it('never offers a half-open bracket or a half-word', () => {
    const title = releaseTitleFor(proposeArtworks(artworksInFile(real)));
    expect(title).not.toMatch(/[([,\-\s]$/);
    expect(title).toBe(title.trim());
  });

  it('lets one artwork name itself', () => {
    expect(releaseTitleFor(proposeArtworks(artworksInFile(invented)))).toBe('Falling Light');
    expect(releaseTitleFor(proposeArtworks(artworksInFile(sculpture)))).toBe('Vessel VIII');
  });

  it('proposes nothing when artworks share nothing, rather than a fragment', () => {
    /* An empty title stops the primary with "A release needs a title", which is
       a better answer than a confident wrong one. */
    const made = [
      { ...artworksInFile(real)[0], name: 'Flowers of Heaven, 2018' },
      { ...artworksInFile(real)[1], name: 'Lollipop Flowers Rainbow' },
    ];
    expect(releaseTitleFor(made)).toBe('');
  });
});

describe('what the dialogue ends up proposing', () => {
  it('titles the real release after the artist’s work, not one colourway', () => {
    /* The fault: "Guardian (Purple)" was offered as the name of a release that
       is three colourways, and the one-product guard then refused to create it. */
    const proposal = proposeRelease(real);
    expect(proposal.title).toBe('Harbour Light');
    expect(proposal.productKind).toBe('print');
  });

  it('ticks all three colourways and leaves the stray frame alone', () => {
    const proposal = proposeRelease(real);
    expect(proposal.lineItemTitles).toContain('Harbour Light (Dawn) - Public');
    expect(proposal.lineItemTitles).toContain('Harbour Light (Dusk) - Public');
    expect(proposal.lineItemTitles).toContain('Harbour Light (Tide) - Public');
    expect(proposal.lineItemTitles).not.toContain(
      'Night Garden - White Abachi wood frame - UV protective acrylic',
    );
  });

  it('leaves the older fixtures proposing exactly what they did', () => {
    expect(proposeRelease(invented).lineItemTitles).toEqual([
      'Falling Light - Framed',
      'Falling Light - Unframed',
    ]);
    expect(proposeRelease(invented).title).toBe('Falling Light');
    expect(proposeRelease(sculpture).productKind).toBe('sculpture');
  });
});

describe('the prefix trap', () => {
  const named = (...names: string[]) =>
    names.map((name) => ({ ...artworksInFile(real)[0], name }));

  it('does not stop inside a word two names happen to share', () => {
    /* Found by `prove-screens` on a real render, before it was regressed on
       purpose: "Dawn" and "Dusk" both begin with a D, so the common prefix is
       "Harbour Light (D" and every character of it is shared. */
    expect(releaseTitleFor(named('Harbour Light (Dawn)', 'Harbour Light (Dusk)'))).toBe(
      'Harbour Light',
    );
  });

  it('holds for three colourways, and for a bracketless pair', () => {
    expect(
      releaseTitleFor(named('Harbour Light (Dawn)', 'Harbour Light (Dusk)', 'Harbour Light (Tide)')),
    ).toBe('Harbour Light');
    expect(releaseTitleFor(named('Guardian Purple', 'Guardian Green'))).toBe('Guardian');
  });

  it('proposes nothing rather than a single shared letter', () => {
    expect(releaseTitleFor(named('Amber', 'Anvil'))).toBe('');
  });

  it('keeps a name that is genuinely shared in full', () => {
    expect(releaseTitleFor(named('Guardian', 'Guardian'))).toBe('Guardian');
  });
});
