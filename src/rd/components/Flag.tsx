/**
 * The flag that stands for a country in a table column (ruling 13).
 *
 * **The flag stands ALONE** (ruling 13 as amended). The column is scanned, not
 * read: eight two-letter codes are eight things to parse, where eight flags
 * are one glance. That is the whole of the ruling, and it is the reason the
 * component exists.
 *
 * The code is not lost, it moves. `alt` carries it, so a screen reader is told
 * "SE" rather than "image"; `title` carries it, so hovering names it for
 * anyone who does not know the flag by sight. That is the opposite of the
 * first version of this ruling, which had the code beside the flag and `alt`
 * empty — with nothing beside it, an empty `alt` would make the cell silent.
 *
 * **Host the images yourself.** The ruling is explicit that production must
 * not pull them from a CDN, and it is right to be: an admin behind a login
 * with a runtime dependency on a third party for a screen only staff see is a
 * third party who can take that screen down. Fetch the set once at `w20`,
 * commit them, and serve them from `IMG_BASE` below. Twenty-seven of them is
 * about 112KB.
 *
 * **A code that is not a country still gets a mark**, not a blank. A grouping
 * like "rest of world" is what is left over rather than a place, so it has no
 * national flag — give it a drawn one (a globe, on the same 14x10) through
 * `drawn`. The first cut of this ruling gave it a spacer and the word instead,
 * which left one cell in the column that had to be READ while the rest were
 * glanced at.
 *
 * ⚠ **Do not use this for a language.** Austrian and Swiss German are German,
 * Mexican Spanish is Spanish, and a language is not a country. The only place
 * that trade is defensible is a closed set where each locale was chosen FOR a
 * particular country, and even there it wants a decision recorded rather than
 * a component that invites it.
 *
 * ⚠ **Some screens are exempt.** A statutory filing states its jurisdiction in
 * words, never as a picture.
 */

/** Where the committed flag images are served from. */
const IMG_BASE = '/flags'

/**
 * Codes whose flag file differs from the code, keyed uppercase.
 *
 * Two kinds end up here. A code that is your own name for a place rather than
 * the country's — `UK` where ISO 3166-1 says `gb` — and a code that is not a
 * country at all but has a flag anyway, like `EU`.
 */
export const ISO_ALIAS: Record<string, string> = { UK: 'gb', EU: 'eu' }

/** Codes drawn rather than photographed: an SVG mark, not a nation's flag. */
export const ISO_DRAWN: Record<string, string> = { ROW: 'row' }

export default function Flag({
  code,
  name,
  alias = ISO_ALIAS,
  drawn = ISO_DRAWN,
}: {
  code: string
  /** The full name, for the title. The code alone is what `alt` says. */
  name?: string
  alias?: Record<string, string>
  drawn?: Record<string, string>
}) {
  const key = (code ?? '').trim().toUpperCase()
  /* No code at all: a spacer, so the column's marks stay in one line. There is
     nothing to name and nothing to draw. */
  if (!key) return <span className="rd-flag rd-flag-none" aria-hidden />
  const isDrawn = drawn[key]
  const iso = isDrawn ?? alias[key] ?? key.toLowerCase()
  /* The code, not the country's name: it is what the rest of the app calls
     this place, what a person would search for, and what they would say out
     loud. The full name rides in the title beside it for anyone who needs it. */
  return (
    <img
      className="rd-flag"
      src={`${IMG_BASE}/${iso}.${isDrawn ? 'svg' : 'png'}`}
      width={14}
      height={10}
      alt={key}
      title={name ? `${key} — ${name}` : key}
      /* A flag that fails to load must not leave a broken-image glyph in a
         column — it falls back to the spacer, and the alt text is what the
         cell then says. */
      onError={(e) => {
        e.currentTarget.classList.add('rd-flag-none')
        e.currentTarget.removeAttribute('src')
      }}
    />
  )
}
