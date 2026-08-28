/**
 * The app's own primitives, in the kit's vocabulary.
 *
 * The kit ships 21 components and the 65-section stylesheet they wear. What it
 * deliberately does not ship is the shell and the screens — so the shapes every
 * screen here needs and the kit has no component for (a page head, a card with
 * a head row, a dialogue, a band, a pill) are written ONCE, here, out of the
 * kit's classes. None of them invent a value: every one is `css/redesign.css`
 * or `css/app.css` markup with a React shape around it.
 *
 * Reuse this before writing a component (SKILL.md), and reach for the kit's own
 * `src/rd/components/*` before either: `Menu`, `Field`, `Tabs`, `BulkBar`,
 * `RowTick`, `ColumnsMenu` and the rest are already the answer to most of what
 * a screen asks.
 */
import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ReactElement, ReactNode } from 'react';

/* ---------------------------------------------------------------- the page */

/**
 * A screen. The title row, the facts under it, and the work.
 *
 * `actions` are the page's own controls and sit at one height whatever their
 * fill (ruling 89j) — the CSS does that, so a caller passes plain chips and a
 * primary and does not think about it.
 */
export function Page({
  title,
  tag,
  facts,
  actions,
  children,
}: {
  title: ReactNode;
  /** A worded state about the thing the title names — "Active". */
  tag?: ReactNode;
  /** What this record IS, said once so no card below has to repeat it. */
  facts?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}): ReactElement {
  /* No back link, deliberately. The shell's bar carries the path — "Releases ›
     Falling Light" — and the kit is explicit that ruling 24's chevron title is
     superseded by it: "the path is up here now, and drawing it twice is what
     made the old title heavy". A back control on the page would be the second
     drawing, and it would also break the one-row head `prove-screens` measures. */
  return (
    <div className="rd-page">
      <div className="rd-head">
        <div>
          <span className="rd-title">{title}</span>
          {tag ? <span className="rd-crumbtag">{tag}</span> : null}
        </div>
        {actions ? <div className="rd-headacts">{actions}</div> : null}
      </div>
      {facts ? <div className="rd-subhead">{facts}</div> : null}
      {children}
    </div>
  );
}

/**
 * A worded reason that would crowd the row if it were always shown — why a
 * control is not available to you. Never the only place something is said: the
 * control it wraps already carries the answer, this carries the reason.
 */
export function Why({ says, children }: { says: string; children: ReactNode }): ReactElement {
  return (
    <span className="rd-why">
      {children}
      <span className="rd-tip" role="tooltip">
        {says}
      </span>
    </span>
  );
}

/** Cards down a page, at the one gap two stacked cards use. */
export function Stack({ children }: { children: ReactNode }): ReactElement {
  return <div className="rd-stack">{children}</div>;
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): ReactElement {
  return <div className={className ? `rd-card ${className}` : 'rd-card'}>{children}</div>;
}

/** A card's own head: its name, and the controls that act on THIS card. */
export function CardHead({
  title,
  actions,
}: {
  title: ReactNode;
  actions?: ReactNode;
}): ReactElement {
  return (
    <div className="rd-cardhead">
      <span className="rd-sechead">{title}</span>
      {actions ? <div className="rd-cardacts">{actions}</div> : null}
    </div>
  );
}

/** The line under a card's contents — what it holds, counted. */
export function Foot({ children }: { children: ReactNode }): ReactElement {
  return <div className="rd-foot">{children}</div>;
}

/** A key-and-value list: a record's facts where a table of one row would lie. */
export function KV({
  rows,
}: {
  rows: { k: string; v: ReactNode }[];
}): ReactElement {
  return (
    <div className="rd-kv">
      {rows.map((r) => (
        <div key={r.k} style={{ display: 'contents' }}>
          <div className="rd-kvk">{r.k}</div>
          <div className="rd-kvv">{r.v}</div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- the marks */

type PillTone = 'green' | 'amber' | 'blue' | 'red' | 'violet' | 'grey';

/**
 * A STATUS: a state that changes over time. 999px, and always worded — the
 * colour never carries it (ruling 12).
 */
export function Pill({
  tone,
  children,
  small,
}: {
  tone: PillTone;
  children: ReactNode;
  small?: boolean;
}): ReactElement {
  return (
    <span className={`rd-tag rd-tag-${tone}${small ? ' rd-tag-sm' : ''}`}>{children}</span>
  );
}

type TagTone = 'slate' | 'violet' | 'moss' | 'clay' | 'stone' | 'teal' | 'sand' | 'plum' | 'steel';

/**
 * A CATEGORY: a fixed taxonomy value that does not change because time passed.
 * 6px, soft fill, no border — the shape is the distinction, so reaching for
 * the wrong one says the wrong thing however it is tinted.
 */
export function Tag({ tone, children }: { tone: TagTone; children: ReactNode }): ReactElement {
  return <span className={`rd-ctag rd-ctag-${tone}`}>{children}</span>;
}

/** A cell with nothing in it. A dash, in the disabled ink — never blank. */
export function None(): ReactElement {
  return <span className="rd-none">–</span>;
}

/**
 * A long value in a table cell: one line, ellipsised at 27 characters, whole
 * again on hover and in the record the row opens.
 *
 * NOT the kit's `.rd-cap`, which wraps inside its cap — see the note at
 * `.rd-capline` in app.css. A cell in this app is never two lines.
 */
export function Cap({ children }: { children: string }): ReactElement {
  return (
    <span className="rd-capline" title={children}>
      {children}
    </span>
  );
}

/* ----------------------------------------------------------- the controls */

/**
 * Every control the app draws, by role rather than by look.
 *
 * `pri` is the one thing a screen most wants done; `chip` is everything else
 * with a box; `link` is a word that acts, for the third and fourth actions in
 * a dialogue where a fourth box would read as a fourth of the same weight.
 */
export function Btn({
  kind = 'chip',
  children,
  onClick,
  disabled,
  small,
  title,
  type = 'button',
}: {
  kind?: 'pri' | 'chip' | 'grey' | 'link' | 'link-danger' | 'link-mut';
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  small?: boolean;
  title?: string;
  type?: 'button' | 'submit';
}): ReactElement {
  const cls =
    kind === 'pri'
      ? 'rd-btn-pri'
      : kind === 'grey'
        ? 'rd-btn-grey'
        : kind === 'link'
          ? 'rd-linkbtn'
          : kind === 'link-danger'
            ? 'rd-linkbtn rd-linkbtn-danger'
            : kind === 'link-mut'
              ? 'rd-linkbtn rd-linkbtn-mut'
              : small
                ? 'rd-chip rd-chip-sm'
                : 'rd-chip';
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}

/** A quiet action at the end of a row. */
export function RowAct({
  children,
  onClick,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
}): ReactElement {
  return (
    <button
      type="button"
      className={danger ? 'rd-rowact rd-rowact-danger' : 'rd-rowact'}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

/** A word inside a cell that opens something. Reads as a link on approach. */
export function CellLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      className="rd-cellink"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------- the bands */

/**
 * A band the page says something in. Three tones and no more: a warning, a
 * failure, and a note that is telling you something rather than warning you.
 * The dot indexes the sentence — it never replaces it.
 */
export function Bar({
  tone,
  children,
}: {
  tone: 'warn' | 'fail' | 'note';
  children: ReactNode;
}): ReactElement {
  if (tone === 'note') {
    return (
      <div className="rd-notebar">
        <span className="rd-notedot" aria-hidden>
          ●
        </span>
        <div>{children}</div>
      </div>
    );
  }
  return (
    <div className={tone === 'fail' ? 'rd-warnbar rd-failbar' : 'rd-warnbar'}>
      <span className={tone === 'fail' ? 'rd-faildot' : 'rd-warndot'} aria-hidden>
        ●
      </span>
      <div>{children}</div>
    </div>
  );
}

/**
 * A dialogue's read-only context: where something stands before anything is
 * typed, so the figures being changed have something to be changed against.
 * Boxes in the same vocabulary as the form below them, never prose.
 */
export function Facts({ items }: { items: { label: string; value: ReactNode }[] }): ReactElement {
  return (
    <div className="rd-facts">
      {items.map((f) => (
        <div className="rd-fact" key={f.label}>
          <span>{f.label}</span>
          <b>{f.value}</b>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------- the dialogue */

/**
 * A decision that has to be made or abandoned — which is what the scrim says,
 * and what makes this a dialogue rather than a popover.
 *
 * Escape closes it, the scrim closes it, and the primary action is a button
 * rather than a form submit so a screen never has to think about enter.
 */
export function Dialog({
  open,
  title,
  size = 'md',
  onClose,
  primary,
  secondary,
  danger,
  children,
}: {
  open: boolean;
  title: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  onClose: () => void;
  primary?: { label: string; onClick: () => void; disabled?: boolean; destructive?: boolean };
  /** One or several, in the order the foot should read them. */
  secondary?: { label: string; onClick: () => void } | { label: string; onClick: () => void }[];
  /** The word that acts, at the far end of the foot — "Delete", "Remove". */
  danger?: { label: string; onClick: () => void };
  children: ReactNode;
}): ReactElement | null {
  /* A dialogue tall enough to scroll opens at its top. Without this it opens
     wherever the browser last put the scroll — which on the image picker meant
     the grid's second row, with the title above the fold and no sign that
     there was anything above it. */
  const panel = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (open && panel.current) panel.current.scrollTop = 0;
  }, [open]);

  if (!open) return null;
  /* A PORTAL, for the reason the kit's own `Menu` is one: a dialogue rendered
     where it is written is a descendant of a card and of the work area's
     scroller, and it is drawn against whichever of those turns out to be its
     containing block rather than against the window. Rendered in place, the
     image picker's scrim covered only the card it was opened from and the
     panel was clipped to it — title above the cut, foot below it. The body is
     the only parent that cannot do that. */
  return createPortal(
    <>
      <div className="rd-scrim" onClick={onClose} />
      <div
        ref={panel}
        className={`rd-dialog rd-dialog-${size}`}
        role="dialog"
        aria-modal="true"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      >
        <div className="rd-dialoghd">
          {title}
          <button type="button" className="rd-dialogx" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="rd-dialogbody">{children}</div>
        {primary || secondary || danger ? (
          <div className="rd-dialogfoot">
            {primary ? (
              <button
                type="button"
                className="rd-btn-pri"
                onClick={primary.onClick}
                disabled={primary.disabled}
              >
                {primary.label}
              </button>
            ) : null}
            {(Array.isArray(secondary) ? secondary : secondary ? [secondary] : []).map((s) => (
              <button key={s.label} type="button" className="rd-chip" onClick={s.onClick}>
                {s.label}
              </button>
            ))}
            {danger ? (
              <>
                <span style={{ flex: 1 }} />
                <button type="button" className="rd-linkbtn rd-linkbtn-danger" onClick={danger.onClick}>
                  {danger.label}
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </>,
    document.body,
  );
}

/* ------------------------------------------------------------- the states */

/** A table or a card with nothing in it yet, and what to do about it. */
export function Empty({ children }: { children: ReactNode }): ReactElement {
  return <div className="rd-empty">{children}</div>;
}

/** Before anything has arrived: bars the width of what they stand in for. */
export function Skeleton({ rows = 6 }: { rows?: number }): ReactElement {
  return (
    <div className="rd-skel" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div className="rd-skelrow" key={i} />
      ))}
    </div>
  );
}
