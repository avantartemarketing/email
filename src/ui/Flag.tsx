import type { ReactElement } from 'react';

/**
 * The flag that stands for a country in a table column (ruling 13).
 *
 * **The flag stands alone.** The column is scanned, not read: a hundred
 * country names are a hundred things to parse, where a hundred flags are one
 * glance. The name is not lost, it moves — into the `title`, so hovering names
 * it for anyone who does not know the flag by sight, and into the `aria-label`,
 * so the cell is never silent.
 *
 * ## Why this is not the kit's `Flag`
 *
 * The kit's version is right and cannot be used here. It loads a committed
 * image per country from `/flags/<iso>.png`, and it is emphatic about hosting
 * them: *"an admin behind a login with a runtime dependency on a third party
 * for a screen only staff see is a third party who can take that screen down."*
 * This project has no way to fetch that image set, and — more to the point —
 * the prototype ships as ONE HTML file, where an absolute image path resolves
 * to nothing. That failure is silent: the kit's component falls back to a
 * spacer, so the column would simply go blank. This app has already been
 * bitten twice by exactly that shape of bug with the font.
 *
 * So the flags are drawn, in the bundle, which is hosting them in the truest
 * sense the ruling asks for. They wear the kit's own `.rd-flag` class, at its
 * 14×10 with its hairline ring — drawn so a white-heavy flag survives a white
 * row rather than reading as a missing image.
 *
 * ## About the colours
 *
 * A national flag's colours are the flag's, not this product's, and naming
 * them in `tokens.css` would put thirteen foreign palettes in the file that
 * holds our own. They are the pixels of a picture, which is the category the
 * kit put them in when it made them images. Simplified at 14×10 on purpose:
 * at that size a Union Jack is a few crossed bars, and drawing more would be
 * drawing detail nobody can see.
 */

/** What the order export writes, to what a flag is filed under. */
const ISO: Record<string, string> = {
  'United Kingdom': 'GB',
  'Great Britain': 'GB',
  England: 'GB',
  'United States': 'US',
  USA: 'US',
  Germany: 'DE',
  Netherlands: 'NL',
  France: 'FR',
  Italy: 'IT',
  Spain: 'ES',
  Sweden: 'SE',
  Denmark: 'DK',
  Australia: 'AU',
  Japan: 'JP',
  Canada: 'CA',
  Poland: 'PL',
};

/* Each flag as it is drawn at 14×10. Kept in one place so a column of them is
   one decision, and a fourteenth country is one line rather than a component. */
const DRAWN: Record<string, ReactElement> = {
  GB: (
    <>
      <rect width="14" height="10" fill="#012169" />
      <path d="M0 0 14 10M14 0 0 10" stroke="#fff" strokeWidth="2" />
      <path d="M0 0 14 10M14 0 0 10" stroke="#C8102E" strokeWidth="1" />
      <path d="M7 0v10M0 5h14" stroke="#fff" strokeWidth="3.2" />
      <path d="M7 0v10M0 5h14" stroke="#C8102E" strokeWidth="1.8" />
    </>
  ),
  US: (
    <>
      <rect width="14" height="10" fill="#fff" />
      <path
        d="M0 .7h14M0 2.1h14M0 3.6h14M0 5h14M0 6.4h14M0 7.9h14M0 9.3h14"
        stroke="#B31942"
        strokeWidth="1.4"
      />
      <rect width="6" height="5.4" fill="#0A3161" />
    </>
  ),
  DE: (
    <>
      <rect width="14" height="10" fill="#000" />
      <rect y="3.34" width="14" height="3.33" fill="#DD0000" />
      <rect y="6.67" width="14" height="3.33" fill="#FFCE00" />
    </>
  ),
  NL: (
    <>
      <rect width="14" height="10" fill="#AE1C28" />
      <rect y="3.34" width="14" height="3.33" fill="#fff" />
      <rect y="6.67" width="14" height="3.33" fill="#21468B" />
    </>
  ),
  FR: (
    <>
      <rect width="14" height="10" fill="#fff" />
      <rect width="4.67" height="10" fill="#002395" />
      <rect x="9.33" width="4.67" height="10" fill="#ED2939" />
    </>
  ),
  IT: (
    <>
      <rect width="14" height="10" fill="#fff" />
      <rect width="4.67" height="10" fill="#008C45" />
      <rect x="9.33" width="4.67" height="10" fill="#CD212A" />
    </>
  ),
  ES: (
    <>
      <rect width="14" height="10" fill="#AA151B" />
      <rect y="2.5" width="14" height="5" fill="#F1BF00" />
    </>
  ),
  SE: (
    <>
      <rect width="14" height="10" fill="#006AA7" />
      <path d="M0 5h14" stroke="#FECC00" strokeWidth="2" />
      <path d="M4.6 0v10" stroke="#FECC00" strokeWidth="2" />
    </>
  ),
  DK: (
    <>
      <rect width="14" height="10" fill="#C8102E" />
      <path d="M0 5h14" stroke="#fff" strokeWidth="2" />
      <path d="M4.6 0v10" stroke="#fff" strokeWidth="2" />
    </>
  ),
  AU: (
    <>
      <rect width="14" height="10" fill="#012169" />
      <rect width="6" height="5" fill="#012169" />
      <path d="M0 0 6 5M6 0 0 5" stroke="#fff" strokeWidth="1.1" />
      <path d="M3 0v5M0 2.5h6" stroke="#fff" strokeWidth="1.6" />
      <path d="M3 0v5M0 2.5h6" stroke="#C8102E" strokeWidth="0.9" />
      <circle cx="10" cy="7" r="1.1" fill="#fff" />
      <circle cx="3" cy="8" r="0.7" fill="#fff" />
    </>
  ),
  JP: (
    <>
      <rect width="14" height="10" fill="#fff" />
      <circle cx="7" cy="5" r="2.7" fill="#BC002D" />
    </>
  ),
  CA: (
    <>
      <rect width="14" height="10" fill="#fff" />
      <rect width="3.5" height="10" fill="#D80621" />
      <rect x="10.5" width="3.5" height="10" fill="#D80621" />
      <path d="M7 2.2 7.9 4.3 9.7 3.6 8.9 5.6 10 6.1 7.8 6.6 8 8 7 7.3 6 8 6.2 6.6 4 6.1 5.1 5.6 4.3 3.6 6.1 4.3Z" fill="#D80621" />
    </>
  ),
  PL: (
    <>
      <rect width="14" height="10" fill="#fff" />
      <rect y="5" width="14" height="5" fill="#DC143C" />
    </>
  ),
};

export function Flag({ country }: { country: string | null | undefined }): ReactElement {
  const name = (country ?? '').trim();
  const code = ISO[name];
  const drawn = code ? DRAWN[code] : undefined;
  /* No country, or one nobody has drawn yet: a spacer, so the column's marks
     stay on one line and nothing renders as a broken picture. The name is
     still on the cell for anyone hovering it. */
  if (!drawn) {
    return <span className="rd-flag rd-flag-none" title={name || undefined} aria-hidden />;
  }
  return (
    <svg
      className="rd-flag"
      viewBox="0 0 14 10"
      width={14}
      height={10}
      role="img"
      aria-label={name}
    >
      <title>{name}</title>
      {drawn}
    </svg>
  );
}
