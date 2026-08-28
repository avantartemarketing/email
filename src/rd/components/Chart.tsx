/**
 * The one chart shape — ruling 15.
 *
 * "The admin has exactly one chart shape. Every screen that plots anything
 * list all use it." Three screens drew three charts before this, each with its
 * own geometry, its own ladder and its own idea of where zero was. This is the
 * one, and the screens pass it data.
 *
 * The ruling, in its own terms:
 *
 * - **One plot box.** The LINE owns the y ladder. The band sits behind it as
 *   pale bars anchored to the floor, with **no gridlines touching it and no
 *   second y-axis, ever**. A second axis is the thing that makes two unrelated
 *   quantities look comparable, and they are not.
 * - **The band's level is stated once, in words**, beneath the plot: "Bars are
 *   weekly paid social spend on their own scale — read them for shape, not
 *   level. Peak EUR 4,600." That sentence is the band's axis.
 * - **One x-axis, printed once.**
 * - **Ladder labels run low-to-high**, `0` at the baseline.
 * - **Signed bands** get their own zero line inside the same box, drawn once,
 *   `#e4ebf4` up and `#f2e2df` down.
 *
 * ## ⚠ Every position comes from `x()` and `y()`
 *
 * Ruling 15 names two bugs from Design's own drafts, both from hand-placed
 * geometry, and both of the kind that look fine until measured:
 *
 * 1. Ladder labels emitted top-down while the paths drew bottom-up — `100%`
 *    printed on the baseline, and a 74% line ended beside a gridline labelled
 *    `25%`.
 * 2. Dots placed from hand-assigned week numbers while month ticks sat at a
 *    fake four-weeks-per-month, accumulating **41px — eleven days** of drift:
 *    a 25 Aug send rendered on the September tick.
 *
 * So there is exactly one `x` and one `y` in this file, and the ticks, the
 * ladder, the gridlines, the bars, the line and every label are all read out of
 * them. Nothing in here may compute a coordinate any other way.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * The frame, in CSS pixels — which is the whole point of measuring the card
 * rather than scaling a fixed viewBox into it.
 *
 * A 900-unit box stretched to fill a 1,330px card scales EVERYTHING by 1.48,
 * including the type: an 11px rung label renders at 16px and the chart quietly
 * leaves ruling 10's reading scale. So the box is measured and the viewBox is
 * the real width; one user unit is one pixel, and 11px is 11px.
 *
 * `w` is the fallback for the first paint, before the card has been measured.
 */
/**
 * The plot's frame, in user units — and one user unit is one pixel, because
 * the box is measured rather than stretched (ruling 15's second named bug).
 *
 * `top`→`floor` is the LINE's plot; `floor`→`base` is the band's strip below
 * it, on its own scale. The strip was 44 and the owner asked for bars twice as
 * high, which is a change to the STRIP rather than to the bars: at 44 a
 * doubled bar rose past `floor` and into the line's plot, and a bar reaching
 * into the line's scale is a second axis by accident — the one thing ruling 15
 * forbids outright. So the box grew by 50 and the line's plot is untouched:
 * bigger bars, not a smaller line.
 */
export const BOX = { w: 900, h: 250, left: 44, right: 900, top: 10, floor: 150, base: 244 }

export interface Point {
  /** Where it sits along x — an index into the series, not a date. */
  i: number
  /** The line's value. Null breaks the line rather than drawing through it:
   *  a week nobody measured is not a week of zero. */
  v: number | null
}

export interface Band {
  i: number
  /** Up. Drawn pale from the floor. */
  up: number
  /** Down, for a signed band — signups above, unsubscribes below. */
  down?: number
}

export interface Tick {
  i: number
  label: string
}

/**
 * One thing that happened in the point under the pointer — a post that week, a
 * send, a shipment.
 *
 * The owner asked for it on Social: hovering a bar says how many were
 * published and would not say WHAT. The figures answer "how much"; these
 * answer "of what", which is the question a spike actually raises, and the
 * answer is already on the screen in the table below — this saves the scroll
 * and the counting.
 *
 * Assembled by the screen, like everything else in the readout: `Chart` has no
 * idea what its band counts, and a chart that guessed would be captioning
 * somebody else's data.
 */
export interface ReadoutItem {
  /** Stable per item — two items can look alike, so nothing drawn is a key. */
  key: string
  /** When, inside the period. */
  when: string
  /** What KIND of thing it is — the taxonomy value, in a word. */
  what: string
  /**
   * A picture of the thing, where one exists.
   *
   * The owner's instruction on Social: a post IS its image, and several
   * captions start the same way, so the picture identifies it where the
   * words did not. Null keeps the space rather than closing it up — a run
   * of rows where some are indented and some are not reads as two lists.
   */
  thumb?: string | null
}

export interface Readout {
  head: string
  lines: string[]
  /** What happened in this period, named. Empty or absent draws nothing. */
  items?: ReadoutItem[]
  /**
   * What the list left out, in words — a hover box is a glance, not a page, so
   * it takes the first few and SAYS it did rather than trailing off.
   */
  more?: string
}

/** What the chart cannot draw, and why — ruling 15's three states. */
export type ChartState =
  | { kind: 'ok' }
  /** Nothing recorded. The frame and a sentence — NEVER a flat line at zero,
   *  which reads as "sold nothing" rather than "nothing recorded". */
  | { kind: 'empty'; says: string }
  /** Drawn, at half opacity, under a worded warnbar naming the age. */
  | { kind: 'stale'; says: string }
  /** Nothing at all: no axes, no baseline, no zero line. A chart that renders
   *  is a chart someone reads, and a chart drawn from bad numbers is read. */
  | { kind: 'unreadable'; says: string }

/**
 * A SIGNED ladder, for a scale that crosses zero.
 *
 * `ladder()` starts at a floor and rises. Growth does not: a period down 12%
 * against one up 30% needs zero somewhere in the middle, and both halves to
 * scale — stretching one to fit is how a small fall comes to look like a
 * collapse. So this walks out from zero in both directions by the same step.
 *
 * Returned ascending, like `ladder()`, for the same reason: ruling 15's first
 * named bug was a ladder emitted against the direction its paths were drawn.
 */
export function signedLadder(hi: number, lo: number, steps = 4): number[] {
  const span = Math.max(hi, 0) - Math.min(lo, 0)
  if (!(span > 0)) return [0]
  const raw = span / steps
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 1.5, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => v >= raw) ?? 10 * mag
  const out: number[] = []
  const start = Math.floor(Math.min(lo, 0) / step) * step
  const end = Math.ceil(Math.max(hi, 0) / step) * step
  for (let v = start; v <= end + step / 1000; v += step) out.push(Math.abs(v) < step / 1000 ? 0 : v)
  return out
}

/**
 * A ladder that lands on round numbers, low to high.
 *
 * Returned in ASCENDING order on purpose. Ruling 15's first named bug was a
 * ladder emitted top-down against paths drawn bottom-up, so `0` is index 0
 * here and `y()` is what decides where it goes.
 */
export function ladder(max: number, steps = 4): number[] {
  if (!(max > 0)) return [0]
  const raw = max / steps
  const mag = 10 ** Math.floor(Math.log10(raw))
  /* 1.5 is in here so a ladder hugs its data: without it a peak of 4,300
     lands on a step of 2,000 and a ladder topping out at 8,000 — nearly twice
     the tallest thing on the chart, so the line lives in the bottom half of a
     frame that is mostly air.

     1.25 is deliberately NOT, though it hugs closer still. It puts rungs on
     12,500 and 37,500, and reach is printed in thousands — so the ladder came
     out "0 · 13k · 25k · 38k · 50k", where two of the four rungs are rounded
     and neither is the number it stands for. A rung has one job, and that is
     to be a round number you can read off. */
  const step = [1, 1.5, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag
  const out: number[] = []
  for (let v = 0; v <= step * steps + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6)
  return out
}

/** The ladder's top, which is what `y()` scales against. */
export const ladderMax = (max: number, steps = 4): number => {
  const l = ladder(max, steps)
  return l[l.length - 1] || 1
}

/**
 * A floor that lands on a round number.
 *
 * A ladder lifted to the data's own low prints rungs like `29,849 · 49,849 ·
 * 69,849`, where the offset rides on every rung and none of them is a number
 * anybody reads. Snapping the floor DOWN to a whole step gives `20,000 ·
 * 40,000 · 60,000` and costs a little headroom below the line, which is the
 * cheaper of the two.
 */
export function snapFloor(floor: number, max: number, steps = 4): number {
  if (!(floor > 0) || !(max > floor)) return 0
  const l = ladder(max - floor, steps)
  /* A FIFTH of a rung's step, not a whole one. Snapping to the whole step took
     a floor of 37,000 down to 20,000 and gave back most of the headroom the
     lift was for — the line then started a third of the way up a plot whose
     bottom third was empty. A fifth still lands on a round number and costs
     almost nothing. */
  const step = (l[1] ?? 1) / 5
  return Math.max(0, Math.floor(floor / step) * step)
}

/**
 * The ladder's FLOOR, where it is not zero.
 *
 * Ruling 15 says the ladder runs low-to-high with `0` at the baseline, and for
 * every chart it names that is right. Total subscribers is the one series it
 * is wrong for: a list of 41,000 that grew by 900 over the window is a flat
 * line halfway up a zero-based plot, and the thing the chart is FOR — the
 * shape of the growth — is invisible.
 *
 * So a floor is allowed, and the cost is stated where it lands: a chart whose
 * ladder does not start at zero EXAGGERATES its own movement, so `Chart`
 * refuses to draw one without saying so in the sentence beneath the plot. That
 * is the same bargain the band makes — the band has no axis and states its
 * level in words; a lifted ladder has an axis and states its floor.
 */
export interface Scales {
  /** Index → user-unit x. */
  x: (i: number) => number
  /** Value → user-unit y, against the LINE's ladder. */
  y: (v: number) => number
  /** Band value → bar height in user units, on the band's own scale. */
  bandH: (v: number) => number
  top: number
  barW: number
}

/**
 * The one place a coordinate is computed. Everything else reads these.
 *
 * @param n how many points across
 * @param max the line's own peak — the ladder is built from it
 * @param bandMax the band's peak, on its own scale, which never gets an axis
 */
export function scales(
  n: number,
  max: number,
  bandMax: number,
  width = BOX.w,
  rawFloor = 0,
  gutter = BOX.left,
  /* A signed band splits its strip in two, so each half gets less room. Left
     at the unsigned height its up-bars rose past the ladder's baseline and
     into the line's plot — which is the one thing a band must never do, since
     a bar reaching into the line's scale is a second axis by accident. */
  signed = false,
): Scales {
  const floor = snapFloor(rawFloor, max)
  const top = ladderMax(max - floor) + floor
  const span = width - gutter - 4
  return {
    // One point centres; the rest span the plot. `n - 1` because the first
    // sits on the axis and the last on the right edge.
    x: (i) => (n <= 1 ? gutter + span / 2 : gutter + (i / (n - 1)) * span),
    y: (v) => BOX.floor - ((v - floor) / (top - floor || 1)) * (BOX.floor - BOX.top),
    /* The band's OWN scale, and this is exactly why the sentence beneath the
       plot has to state its level: nothing on the frame says what a bar's
       height is worth, because a second axis would say these two quantities
       are comparable and they are not. */
    /* Twice what it was, at the owner's word, and it fits because the strip
       grew with it: 60 of the 94 between `floor` and `base` unsigned, and 40
       either side of the middle when the band is signed. */
    bandH: (v) => (Math.abs(v) / (bandMax || 1)) * (signed ? 40 : 60),
    top,
    /* And twice as wide. 0.36 of the gap between points left a week's bar
       looking like half a week — the owner's words — with more space between
       bars than bar. 0.72 leaves a clear gap and still reads as one column per
       point. The cap rises with it: at 11 a chart of few points drew hairlines
       with acres between them. */
    barW: Math.max(2, Math.min(24, (span / Math.max(n, 1)) * 0.72)),
  }
}

export default function Chart({
  points,
  bands = [],
  ticks,
  state = { kind: 'ok' },
  /** What the line's numbers ARE — the ladder's own caption. */
  yLabel,
  /** How a ladder value prints. */
  fmt = (v) => v.toLocaleString('en-GB'),
  /** Ruling 15: the band's level, stated ONCE, in words, beneath the plot. */
  bandSays,
  /** Up to two numbers at the line's end — actual and plan. Never stacked. */
  endLabels = [],
  signed = false,
  bandMax = 1,
  /** Further lines against the SAME ladder. Never against one of their own —
   *  a second scale is a second axis wearing a different hat. */
  extra = [],
  /** What should have happened. Dashed, and not a series: drawing it like the
   *  actuals would make the plan a fourth series. */
  plan = [],
  /** How wide the x runs where it is not the point count — a period may be 31
   *  weeks whether or not 31 of them have rows yet, and a chart that ends at
   *  week 19 makes a series still in progress look finished. */
  span,
  max,
  /** Where the ladder starts. Non-zero exaggerates movement, so it must be
   *  said in `bandSays` — Chart refuses to draw one silently. */
  floor = 0,
  /**
   * What a point says when the pointer is over it — the week, the line's
   * figure, and what the band's bar is counting.
   *
   * Supplied by the screen rather than assembled here: only the screen knows
   * whether its band is posts, or signups, or units, and a chart that guessed
   * would be captioning somebody else's data. Returning null draws no readout
   * for that index, which is what a week nobody measured should do.
   */
  readout,
  children,
}: {
  points: Point[]
  bands?: Band[]
  ticks: Tick[]
  state?: ChartState
  yLabel?: string
  fmt?: (v: number) => string
  bandSays?: string
  endLabels?: Array<{ text: string; v: number; tone?: 'plan' }>
  signed?: boolean
  bandMax?: number
  extra?: Array<{ key: string; label: string; points: Point[]; tone: string }>
  plan?: Point[]
  span?: number
  max: number
  floor?: number
  readout?: (i: number) => Readout | null
  children?: ReactNode
}) {
  /* The card's own width, measured. Ruling 15 says derive every position from
     one function — this is the one input that function needs and cannot be
     computed. */
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(BOX.w)
  /* Which point the pointer is nearest, or null when it is off the plot. The
     owner asked for the line AND the bars to answer; they are one x, so they
     are one piece of state and one readout rather than two that could
     disagree about the same week. */
  const [over, setOver] = useState<number | null>(null)
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(320, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  /* Unreadable draws NOTHING. Not an empty frame, not a baseline — a chart
     that renders is a chart someone reads, and there is nothing here to read. */
  if (state.kind === 'unreadable')
    return (
      <div className="rd-chartfail" role="alert">
        {state.says}
      </div>
    )

  const n = span ?? Math.max(points.length, ...extra.map((e) => e.points.length), plan.length)
  const base = snapFloor(floor, max)
  const rungs = ladder(max - base).map((v) => v + base)
  const right = width
  /* The gutter is as wide as its widest rung needs. It was a fixed 44, and a
     subscriber ladder topping out at 120,000 had its top label clipped to
     "20,000" — a rung that is not merely unreadable but reads as a DIFFERENT
     NUMBER, and one that also appears further down the same ladder. 6.4px is
     Inter's tabular digit at 11px; the ladder is all digits and separators. */
  const gutter = Math.max(BOX.left, Math.max(...rungs.map((v) => fmt(v).length)) * 6.4 + 12)
  const s = scales(n, max, bandMax, width, floor, gutter, signed)
  /* A signed band needs its own zero INSIDE the box, drawn once. It sits
     between the floor and the base so both halves have room. */
  const bandZero = signed ? (BOX.floor + BOX.base) / 2 : BOX.base

  /* The line, in segments. A null breaks it: drawing through a week nobody
     measured invents a number, and the gap is the honest mark.

     One builder for every line on the chart — the main one, the extras and the
     plan — so a second series cannot acquire geometry of its own. */
  const segmentsOf = (pts: Point[]): string[][] => {
    const out: string[][] = []
    let cur: string[] = []
    for (const p of pts) {
      if (p.v == null) {
        if (cur.length > 1) out.push(cur)
        cur = []
        continue
      }
      cur.push(`${s.x(p.i).toFixed(1)},${s.y(p.v).toFixed(1)}`)
    }
    if (cur.length > 1) out.push(cur)
    return out
  }
  const segments = segmentsOf(points)
  /* A single measured point among nulls draws no segment, so it gets a dot —
     otherwise one week of data renders as an empty frame. */
  const lone = segments.length === 0 ? points.filter((p) => p.v != null) : []

  /* End labels must not collide, and the ruling says nudge one rather than
     stacking them. 13 user units is the label's own line box. */
  /* Nine units up: the label's own y IS the line's last point, so left where
     it lands the polyline runs straight through the digits and reads as a
     strikethrough. Above the line is the only side that is always free. */
  const placed = endLabels
    /* Clamped into the box: a point at the ladder's top puts its label above
       the frame, where the svg clips it and the number is simply gone. */
    .map((l) => ({ ...l, at: Math.min(BOX.floor, Math.max(BOX.top + 4, s.y(l.v) - 9)) }))
    .sort((a, b) => a.at - b.at)
    .map((l, i, all) => (i > 0 && l.at - all[i - 1].at < 13 ? { ...l, at: all[i - 1].at + 13 } : l))

  return (
    <div ref={box} className={state.kind === 'stale' ? 'rd-chart rd-chart-stale' : 'rd-chart'}>
      {state.kind === 'stale' && <div className="rd-warnbar">{state.says}</div>}
      {/* The viewBox is the MEASURED width, so one user unit is one pixel and
          nothing is scaled. Two wrong answers were tried first: a fixed
          `height` letterboxed the 900-unit box inside a 1,330px card, leaving
          empty margins that read as a layout bug; and stretching it to fit
          scaled the type with it, so an 11px rung label rendered at 16px and
          the chart left the reading scale. */}
      <svg
        viewBox={`0 0 ${width} ${BOX.h}`}
        width={width}
        height={BOX.h}
        className="rd-chartsvg"
        role="img"
        aria-label={yLabel}
      >
        {/* The ladder. Low to high, `0` on the baseline — read out of `y()`
            rather than laid out, which is ruling 15's first named bug. */}
        <g className="rd-chartgrid">
          {rungs.map((v) => (
            <line key={v} x1={gutter} x2={right} y1={s.y(v)} y2={s.y(v)} />
          ))}
        </g>
        <g className="rd-chartrung">
          {rungs.map((v) => (
            <text key={v} x={gutter - 8} y={s.y(v) + 3.5} textAnchor="end">
              {fmt(v)}
            </text>
          ))}
        </g>

        {/* The band, behind the line and anchored to its own floor. No
            gridline touches it: the grid above stops at the line's baseline. */}
        <g className="rd-chartband">
          {bands.map((b) => (
            <g key={b.i}>
              {b.up > 0 && (
                <rect
                  x={s.x(b.i) - s.barW / 2}
                  y={bandZero - s.bandH(b.up)}
                  width={s.barW}
                  height={s.bandH(b.up)}
                />
              )}
              {signed && (b.down ?? 0) > 0 && (
                <rect
                  className="rd-chartband-down"
                  x={s.x(b.i) - s.barW / 2}
                  y={bandZero}
                  width={s.barW}
                  height={s.bandH(b.down as number)}
                />
              )}
            </g>
          ))}
        </g>
        {/* A signed band's own zero, drawn once and only when there is one. */}
        {signed && (
          <line className="rd-chartzero" x1={gutter} x2={right} y1={bandZero} y2={bandZero} />
        )}

        {/* The line. Empty draws none of it — ruling 15 forbids a flat zero,
            which reads as "sold nothing" rather than "nothing recorded". */}
        {state.kind !== 'empty' && (
          <>
            {/* The plan first, so the actuals draw over it: what happened is
                the answer and what was planned is the reference. */}
            {plan.length > 0 &&
              segmentsOf(plan).map((pts) => (
                <polyline key={`plan-${pts[0]}`} className="rd-chartline rd-chartplan" points={pts.join(' ')} />
              ))}
            {extra.map((e) =>
              segmentsOf(e.points).map((pts) => (
                <polyline
                  key={`${e.key}-${pts[0]}`}
                  className="rd-chartline"
                  style={{ stroke: e.tone }}
                  points={pts.join(' ')}
                />
              )),
            )}
            {segments.map((pts) => (
              <polyline key={pts[0]} className="rd-chartline" points={pts.join(' ')} />
            ))}
            {lone.map((p) => (
              <circle key={p.i} className="rd-chartlone" cx={s.x(p.i)} cy={s.y(p.v as number)} r={3} />
            ))}
            {placed.map((l) => (
              <text
                key={l.text}
                className={l.tone === 'plan' ? 'rd-chartend rd-chartend-plan' : 'rd-chartend'}
                x={right - 4}
                y={l.at + 3.5}
                textAnchor="end"
              >
                {l.text}
              </text>
            ))}
          </>
        )}

        {/* One x-axis, printed once. */}
        <line className="rd-chartaxis" x1={gutter} x2={right} y1={BOX.base} y2={BOX.base} />
        <g className="rd-charttick">
          {ticks.map((t) => (
            <text key={`${t.i}-${t.label}`} x={s.x(t.i)} y={BOX.h - 2} textAnchor="middle">
              {t.label}
            </text>
          ))}
        </g>

        {/* The pointer's week, marked down the whole plot — line and band at
            once, because they are one x and a reader hovering the bars is
            asking about the same week as a reader hovering the line. */}
        {readout && over != null && state.kind === 'ok' && (
          <g className="rd-chartover" aria-hidden>
            <line x1={s.x(over)} x2={s.x(over)} y1={BOX.top} y2={BOX.base} />
            {points.find((p) => p.i === over)?.v != null && (
              <circle
                cx={s.x(over)}
                cy={s.y(points.find((p) => p.i === over)!.v as number)}
                r={3.5}
              />
            )}
          </g>
        )}

        {/* One transparent strip over the plot, rather than a hit target per
            point: at 31 weeks the gaps between points are wider than the
            points, and a reader between two of them would get nothing. The
            nearest index is computed from x, so every pixel answers. */}
        {readout && state.kind === 'ok' && (
          <rect
            className="rd-charthit"
            x={gutter}
            y={BOX.top}
            width={Math.max(0, right - gutter)}
            height={BOX.base - BOX.top}
            onMouseMove={(e) => {
              const r = (e.currentTarget as SVGRectElement).getBoundingClientRect()
              // The rect is drawn in user units and rendered at `width`, so a
              // client x has to come back through the same scale everything
              // else is drawn in — ruling 15's one function, read backwards.
              const ux = gutter + ((e.clientX - r.left) / (r.width || 1)) * (right - gutter)
              const step = n <= 1 ? 1 : (right - 4 - gutter) / (n - 1)
              setOver(Math.max(0, Math.min(n - 1, Math.round((ux - gutter) / (step || 1)))))
            }}
            onMouseLeave={() => setOver(null)}
          />
        )}
      </svg>

      {/* What that week was, in words and figures. Placed against the plot's
          own width so it never leaves the card: past the middle it flips to
          the left of the marker rather than running off the right edge. */}
      {readout && over != null && state.kind === 'ok' && (() => {
        const said = readout(over)
        if (!said) return null
        const at = (s.x(over) / width) * 100
        const left = at > 55
        return (
          <div
            className={`rd-chartread${left ? ' rd-chartread-left' : ''}`}
            /* Anchored by the edge it is drawn FROM, not always by its left.
               An absolutely positioned box shrinks to fit what is left of its
               containing block past the offset, so a box pinned by `left: 81%`
               and then transformed leftwards had 19% of the card to lay itself
               out in — and clipped a caption that had plenty of room where it
               was actually drawn. Pinning the flipped one by `right` gives it
               the width it is over. */
            style={left ? { right: `${100 - at}%` } : { left: `${at}%` }}
            role="status"
          >
            <div className="rd-chartread-h">{said.head}</div>
            {/* Keyed by position, not by text: two of these lines can read the
                same, and a duplicate key drops one of them silently. */}
            {said.lines.map((l, li) => (
              <div key={li}>{l}</div>
            ))}
            {/* What happened in the period, under a rule — the figures above
                say how much, and these say of what. Same box, because it is
                the same week: a second popover would be a second answer to a
                question with one. */}
            {said.items && said.items.length > 0 && (
              <div className="rd-chartread-list">
                {said.items.map((it) => (
                  <div className="rd-chartread-item" key={it.key}>
                    {it.thumb ? (
                      <img
                        className="rd-chartread-thumb"
                        src={it.thumb}
                        alt=""
                        loading="lazy"
                        /* A thumbnail that will not load leaves the empty
                           frame rather than a broken-image glyph: the row is
                           still a row, and the date beside it still true. */
                        onError={(e) => e.currentTarget.classList.add('rd-chartread-thumb-none')}
                      />
                    ) : (
                      <span className="rd-chartread-thumb rd-chartread-thumb-none" aria-hidden />
                    )}
                    <span className="rd-chartread-when">{it.when}</span>
                    <span className="rd-chartread-what">{it.what}</span>
                  </div>
                ))}
                {said.more && <div className="rd-chartread-more">{said.more}</div>}
              </div>
            )}
          </div>
        )
      })()}

      {/* Empty says so in words, over the frame it just drew. */}
      {state.kind === 'empty' && <div className="rd-chartempty">{state.says}</div>}
      {/* The band's axis, in a sentence, once — and the ladder's floor with it
          where the ladder does not start at zero. Both are the same bargain:
          something the frame cannot say, said in words directly beneath it. */}
      {state.kind !== 'empty' && (bandSays || base > 0) && (
        <div className="rd-chartsays">
          {base > 0 && `The scale starts at ${fmt(base)}, not zero — read the shape, not the height. `}
          {bandSays}
        </div>
      )}
      {children}
    </div>
  )
}


/* ==========================================================================
   The second MARK, not a second chart.

   Ruling 15 names three screens and gives them one shape: a line over a ghost
   band, for a series through time. Sales history is not one of them and is not
   that question — it compares periods against each other, which is a
   comparison across categories rather than a series, and a line joining 2024
   to 2025 to 2026 would assert a continuity the data does not have.

   So this is grouped bars, and what it shares with `Chart` is the part ruling
   15's ⚠ is actually about: ONE `x()` and ONE `y()`, the ladder derived rather
   than laid out, the box measured rather than scaled, and the type left on the
   reading scale. Same file, same discipline, different mark.
   ========================================================================== */

export interface BarGroup {
  key: string
  label: string
  /** Drawn at half weight — a period counted to a date, not a whole one. */
  partial?: boolean
  bars: Array<{ key: string; label: string; v: number | null; tone: string }>
}

export function Bars({
  groups,
  fmt = (v) => v.toLocaleString('en-GB'),
  /** What a bar means, in full, on hover. */
  says,
  state = { kind: 'ok' },
  yLabel,
}: {
  groups: BarGroup[]
  fmt?: (v: number) => string
  says?: (group: BarGroup, bar: BarGroup['bars'][number]) => string
  state?: ChartState
  yLabel?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(BOX.w)
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(320, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (state.kind === 'unreadable')
    return (
      <div className="rd-chartfail" role="alert">
        {state.says}
      </div>
    )

  const values = groups.flatMap((g) => g.bars.map((b) => b.v)).filter((v): v is number => v != null)
  const empty = state.kind === 'empty' || values.length === 0
  const rungs = signedLadder(Math.max(...values, 0), Math.min(...values, 0))
  const hi = Math.max(...rungs)
  const lo = Math.min(...rungs, 0)
  const range = hi - lo || 1

  /* The gutter is as wide as its widest rung needs — the same lesson a
     ladder of "120,000" taught the line chart. */
  const gutter = Math.max(BOX.left, Math.max(...rungs.map((v) => fmt(v).length)) * 6.4 + 12)
  const top = BOX.top
  const floor = BOX.floor + 24
  /* Zero sits where zero falls in the range, so a chart with a fall in it
     keeps both halves to scale rather than stretching one. */
  const zero = top + (hi / range) * (floor - top)
  const y = (v: number) => (v >= 0 ? zero - (v / range) * (floor - top) : zero + (-v / range) * (floor - top))

  const span = width - gutter - 8
  const gw = span / Math.max(groups.length, 1)
  const n = Math.max(...groups.map((g) => g.bars.length), 1)
  const bw = Math.max(4, Math.min(16, (gw - 14) / n - 4))
  const gap = 4
  const cluster = n * bw + (n - 1) * gap

  return (
    <div ref={box} className={state.kind === 'stale' ? 'rd-chart rd-chart-stale' : 'rd-chart'}>
      {state.kind === 'stale' && <div className="rd-warnbar">{state.says}</div>}
      <svg
        viewBox={`0 0 ${width} ${BOX.h + 24}`}
        width={width}
        height={BOX.h + 24}
        className="rd-chartsvg"
        role="img"
        aria-label={yLabel}
      >
        <g className="rd-chartgrid">
          {rungs.map((v) => (
            <line key={v} x1={gutter} x2={width} y1={y(v)} y2={y(v)} />
          ))}
        </g>
        <g className="rd-chartrung">
          {rungs.map((v) => (
            <text key={v} x={gutter - 8} y={y(v) + 3.5} textAnchor="end">
              {fmt(v)}
            </text>
          ))}
        </g>
        {/* Zero is drawn once, at the axis's own weight — a bar chart that
            crosses it needs to say where it crossed. */}
        <line className="rd-chartaxis" x1={gutter} x2={width} y1={zero} y2={zero} />

        {!empty &&
          groups.map((g, i) => {
            const gx = gutter + i * gw + (gw - cluster) / 2
            return (
              <g key={g.key} opacity={g.partial ? 0.55 : 1}>
                {g.bars.map((b, j) => {
                  if (b.v == null) return null
                  const h = Math.max(Math.abs(y(b.v) - zero), 1)
                  return (
                    <rect
                      key={b.key}
                      x={(gx + j * (bw + gap)).toFixed(1)}
                      y={(b.v >= 0 ? zero - h : zero).toFixed(1)}
                      width={bw.toFixed(1)}
                      height={h.toFixed(1)}
                      fill={b.tone}
                    >
                      <title>{says ? says(g, b) : `${b.label} · ${g.label} · ${fmt(b.v)}`}</title>
                    </rect>
                  )
                })}
              </g>
            )
          })}

        <g className="rd-charttick">
          {groups.map((g, i) => (
            <text key={g.key} x={(gutter + i * gw + gw / 2).toFixed(0)} y={BOX.h + 20} textAnchor="middle">
              {g.label}
            </text>
          ))}
        </g>
      </svg>
      {empty && <div className="rd-chartempty">{state.kind === 'empty' ? state.says : 'Nothing to compare yet.'}</div>}
    </div>
  )
}
