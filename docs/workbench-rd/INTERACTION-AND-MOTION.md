# Ruling 27 — Interaction polish and motion

From Design, 22 Aug 2026. Commit as `docs/INTERACTION-AND-MOTION.md` and add the summary
to `docs/TOKEN-RULINGS.md`. Reference: turns 83–89 in the concept file, all built live.

Nothing here adds a screen. Every item removes a step someone takes several times a day, or replaces
a moment where the interface teleports.

---

## 0 · The two governing rules

**The motion budget.** One curve — `ease-out` — and two durations:

```
120ms   state change      (row, cell, control, tint, fill, collapse)
160ms   overlay           (popover, dialogue, menu, warning band) — scaling from .96–.98
```

Exceptions, and only these: **80ms** for anything tracking the pointer (a crosshair on a longer
curve reads as lag), **140ms** when several rows travel at once (85d, 89g), **420ms** for a
one-off chart draw-in (87e's siblings). No bounce, no overshoot, no spring, no easing zoo — a
300ms overshoot was drawn deliberately in 83h as the counter-example and rejected.

**The test.** If you cannot say in one sentence what a motion tells the user, it does not ship.
Every item below has that sentence in its "says" line.

---

## 1 · Loading and writing

### Skeletons at the real geometry (83a)
Loading tables draw the **true grid** — same 34px rows, same column widths — with grey blocks
(`#e9edf3`, 9px tall, varied widths per column so it reads as a table, not a stack of bars).
**No spinners anywhere in the admin.** A spinner says "I don't know what's coming"; on these screens
we always do.
*Says:* the shape of what is arriving, and that nothing will move when it does.

### Optimistic writes with a quiet undo (83b)
A typed cell commits on Enter — no save button, no spinner, no confirmation. A 2px `#2e8a52` tick
appears at the row's leading edge and `Saved · Undo` rides the toolbar for **4s**.
The undo is what buys the right to skip the confirmation. Applies to Targets cells, bulk edits, and
every line editor.

### Derived figures follow the one you changed (83c)
When an input changes, every figure computed from it **counts** to its new value over 140–160ms
(cubic ease-out, tabular figures). This is the whole argument for editing on a sheet rather than in
a form: you see what your change did downstream.
*Implementation:* guarantee the end state with a `setTimeout(ms + 90)` that writes the final value —
a dropped frame must not leave a half-counted number on screen.

### Stale while revalidating (83d)
On refresh the table **stays interactive and fully readable**; the freshness caption goes amber and
a worded band says these are the previous run's figures. Never blank-then-refill — that reads as a
crash. Extends the charts' ruled behaviour to every pipeline-fed table.

### Long jobs report inside the control that started them (86e)
A determinate bar fills **inside the button**, whose label reports the outcome (`Preparing…` →
`Downloaded`) then returns. Never a modal spinner over a screen someone was reading.

### Prefetch on hover (83j)
Hovering a sidebar area starts loading its data; the click repaints in the same frame. Invisible as
design, largest perceived-speed win available. Where a cold load is unavoidable, 83a's skeleton covers it.

---

## 2 · Tables

### Sticky header, frozen first column (83f)
On every wide sheet. Cheapest item in this document and the one that
does most for how professional a dense sheet feels.

### The sticky header earns its shadow by scrolling (88i)
Shadow opacity is **proportional to `scrollTop`**, capped at 12px of scroll —
`0 2px 5px rgba(24,29,38,.1)` at full. Tied to position, not duration. At rest, no shadow at all.

### Group bands pin and hand over (89h)
`position:sticky` under the header; the next band pushes the current one out. The group you are
inside is always named, fifty rows down.

### Selection and focus continuity (83g)
After a bulk action the bulk bar becomes `3 updated` for ~1.6s and **the selection survives**.
After a dialogue saves, focus returns to the cell that opened it. Nothing should make anyone
re-find their place.

### The bulk bar cross-fades in place (85e)
Header row and bulk bar occupy **exactly the same 34px box** and cross-fade. This is what makes
ruling 11's replacement legible as a replacement — nothing shifts, the ticked row stays under the
pointer. Never slide a bar in from above.

### Sorting: caret, tint, and rows that travel (89g)
The caret fades in and rotates 180° between directions; the governing column tints
(`#f4f7fb`) for as long as it governs; **the rows travel** to their new order (measure-then-animate,
140ms). All three, or none — a caret that reorders nothing reads as broken, which is exactly the
defect this shipped with first.

### Rows travel on any reorder (85d)
Measure old positions → reorder the DOM → play the difference. One read pass, then one write pass
(interleaving forces a reflow per row). The row someone was watching can be followed rather than
found again.

### Insert and remove make space (85a)
A new line opens from zero height with its content fading in; a removed one reverses. Without it, a
line editor shoves everything below it by 34px with no warning and you cannot tell whether a line
was added or the page jumped.

### Undo lives in the space the row vacated (89e)
A removed row's strip becomes `Line removed · Undo` **at the same height** for ~2.6s, then closes.
The offer sits where the eye already is. No corner toasts anywhere in this admin — nobody looks there.

### Filtering cross-fades, empty keeps the frame (89f)
Rows fade at 120ms rather than the table blanking; when nothing matches, **the frame stays** with a
sentence in it. A table that collapses to nothing reads as a broken screen.

### Group collapse keeps the band still (85c)
The chevron turns, the rows fold, **the band does not move**. Collapsing the top group of a long
screen otherwise takes everything you were reading out of the viewport at once.

### Copy anything — with limits (84d)
Hover shows a small glyph at the cell's right; click copies and flashes `#e7f3ea` for 900ms.
**Only on cells that get pasted elsewhere and do not already own their hover:** references, account
and vendor names, SKUs, emails, amounts, invoice numbers. **Never** on expandable counts, editable
cells, status pills, resize seams, or any cell with its own popover — a hover that means two things
means neither.

### Peek in place (84b) — *drawn, not yet ruled*
Also drawn and awaiting a decision: saved views (84a), changed-since markers (84c), bulk edit from
the bar (84e).

---

## 3 · Navigation and controls

### The active dot travels; areas fold (86a)
The outgoing area folds as the incoming unfolds (160ms); the dot **slides** to its new page.
Both say: you moved *within* one structure. Hard-cutting makes every navigation feel like a page load.

### Drift words change where you can see them (89b)
When the pipeline changes what needs doing, the sidebar counts **count** to their new values and
flash `#8a5800` for ~1.4s. A number that silently rewrites itself while you are on another screen
tells you nothing.

### Segmented fills slide and resize (86b)
The fill travels to the option pressed and resizes to it. Applies to period, scope toggle,
Local $ / GBP, Edit on/off. Two states swapping instantly is genuinely ambiguous — you cannot tell
whether your press took effect or the control redrew.

### Currency swaps without the numbers jumping (89j)
Figures cross-fade at 100ms and stay right-aligned on tabular figures. Only the measure changed.

### The knob travels, the track follows (88c)
120ms both. Edit on/off changes what a whole screen permits — worth an unambiguous state.

### The tick draws, the box fills (88b)
Checkbox tick strokes on via `stroke-dashoffset` over 120ms. Most-clicked control in the admin; an
instant one gives no confirmation the click landed on the row you aimed at.

### Menu items arrive in order (88d)
Panel grows from its button; items fade up with a **14ms stagger**. Reads as one gesture. The
destructive item is last, so it lands after the eye has started reading rather than before.

### Holding a stepper accelerates (89d)
1 → 10 after 500ms → 100 after 1.4s, and the figure counts. Reallocations are hundreds of units; a
stepper that only moves by one is a control people abandon.

### Keyboard, with arrows primary (83e)
**↑ ↓** move rows, **Enter** opens, **Esc** closes and returns focus. `j`/`k` remain as an alias and
nothing more — it is a vim convention from mail clients, it has to be taught, and nobody on a
three-person team should learn a keybinding to move down a list. Both forms `preventDefault` or the
page scrolls under the selection. On dense sheets arrows move **cells**: typing starts an edit, Tab
commits and advances.

### One focus ring, travelling (89c)
A single ring moves between fields on Tab rather than switching off in one place and on in another —
the sidebar-dot argument applied to forms.

### The command palette opens from its field (89a)
Grows from the top-bar search rather than appearing centred. Results **reorder in place** — never
blank between keystrokes — and the first is always pre-selected so Enter always does something.

---

## 4 · Forms, dialogues, warnings

### The floating label rises (88a)
Label travels up and shrinks to 10.5px over 120ms, turning `#254fad` while focused. The motion is
what makes a label doing two jobs legible.

### Validation makes space beneath the field (88f)
Border goes `#b3261e`, the message opens the height it needs, nothing above moves. An error appears
where the wrong thing lives; it may push content down but never over.

### Overlays grow from what opened them (85b)
Popovers scale from .96 with `transform-origin` at the pressed element. The connection is stated by
the motion rather than by an arrow or a tail.

### A dialogue hands off to what it changed (86c)
On save the panel fades **and then** the rows it changed count to their new values with the commit
tick. Without the handoff a panel closes, three numbers are silently different, and nothing connects
the action to the change.

### A warning makes space instead of shoving (86d)
The band opens the space it needs over 160ms and the fault count follows; resolving closes it.
Warnings arrive on their own as the pipeline runs — an instant one shifts the table mid-read.

### Arming a destructive action is visible before it is dangerous (88g)
`− Delete line` sweeps to a solid `#d88a84` border on `#fdf5f4`, and the target rows take a red
leading edge, so the screen is visibly in another mode before the next click removes anything.
Press again — or Esc — to disarm.

### Unlocking is a small mechanical act (89i)
The padlock's shackle lifts and the cell takes the `#e9f7ff` wash in the same 120ms. Received
shipments are locked for a reason; opening one should feel like opening something.

### Status pills change in place — but only where a status is a field (88h)
Tone cross-fades and the pill **resizes to its new word** (measure the target width; auto-width
snaps). **Derived statuses are never clickable** — Invoiced, Part invoiced, Dispatched and Fulfilled
follow from invoicing or dispatching. The cross-fade still plays when they arrive as a consequence;
it is the motion, not a control.

### Dragging lifts, and the others make room (88j)
The dragged row lifts on `0 8px 22px rgba(24,29,38,.16)` and the rows it passes translate out of the
way, so the drop position is visible **before** release.

---

## 5 · Charts

### Drag the axis to zoom (87e)
Drag across weeks: the selection tints `#254fad` at 10% as you drag; on release the line
**interpolates** to the new range (220ms) and the tick density adapts (every 4th / 2nd / every week).
A chip names the window and **is the undo**, so zooming is never a trap. Interpolating rather than
cutting is what keeps the peak identifiable as the same peak.

Not adopted from that round: draw-in on every render, hover-revealed plan lines, scale morphing,
gutter read-outs. The existing brushing (ruling 26) stands unchanged.

---

## 6 · Five implementation traps — we hit every one of these

1. **A property a class animates must NOT be in the inline `style` attribute.** Inline always beats
   a stylesheet rule, so the class can never move it. This broke five demos before it was
   understood. Either put animated properties in the stylesheet, or write them from JS.
2. **Do not split a state change across `requestAnimationFrame`.** Force a reflow
   (`void el.offsetWidth`) to commit the start state, then set the end state **synchronously**. A
   dropped frame otherwise leaves a pill resized but still reading its old word.
3. **Never mix `getBoundingClientRect` with unscaled CSS writes.** The canvas may be zoomed, so
   rects are in scaled px. Use `offsetLeft`/`offsetWidth` for layout maths, or keep everything in
   ratios.
4. **Absolute positioning uses the padding box; `offsetTop` uses the border box.** A travelling
   overlay inside a padded container lands off by exactly that padding. Put it in a wrapper with no
   padding.
5. **Declare `contain: layout style`** on any card that animates. Otherwise every 120ms transition
   competes with a full-document reflow and the motion visibly stutters.

## 7 · Accessibility
Everything above must be wrapped in `@media (prefers-reduced-motion: reduce)`: transitions go to
`0ms`, counts jump to their end value, travel becomes an instant move. **No behaviour is lost** —
every one of these states is legible without its animation, which is the test of whether the
animation was decoration.
