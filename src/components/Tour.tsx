import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { TOUR_PATHS } from './tourSteps';

/**
 * The guided tour: a spotlight over the REAL app while a chosen path's script
 * drives it.
 *
 * It opens on a CHOOSER — four paths, one per job, picked by what the viewer
 * came to learn — because one end-to-end reel made every viewer sit through
 * everybody else's job. The owner, 1 Sep 2026: "split the Take a Tour into a
 * few paths."
 *
 * Three parts, and what each one is for:
 *   - the HOLE — one fixed element whose enormous box-shadow is the scrim, so
 *     the spotlight is a cut-out rather than four dimming panels, and moving
 *     it animates the light from one part of the screen to the next;
 *   - the CARD — title, one caption, and the controls. It sits bottom-centre
 *     always: a card that chases the spotlight around the screen makes the
 *     reader chase it too;
 *   - the CLOCK — autoplay at a brisk read, drawn as a filling bar so the
 *     advance never comes as a surprise. Pause, Back and Next take the wheel
 *     at any time, and the scrim never blocks the pointer — the app
 *     underneath stays yours throughout.
 *
 * Finishing a path returns to the chooser rather than closing: the person
 * who wanted one path often wants a second, and End tour is always one press.
 */
export function Tour({ open, onClose }: { open: boolean; onClose: () => void }): ReactElement | null {
  const navigate = useNavigate();
  const [pathId, setPathId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [driving, setDriving] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  /* Restarting the CSS fill animation needs a new element, not a new width. */
  const [clockKey, setClockKey] = useState(0);
  const runRef = useRef(0);

  const path = TOUR_PATHS.find((p) => p.id === pathId) ?? null;
  const steps = path?.steps ?? [];
  const current = steps[step] ?? null;

  /* Drive the app into the step, then find its spotlight. A stale run (the
     user skipped on, or closed) must never apply its late results. */
  useEffect(() => {
    if (!open || !path) return;
    const run = (runRef.current += 1);
    let cancelled = false;
    setDriving(true);
    setRect(null);
    void (async () => {
      try {
        await path.steps[step].go?.(navigate);
      } catch {
        /* A missing button is the tour's fault, never the viewer's problem —
           the caption still explains the chapter. */
      }
      if (cancelled || runRef.current !== run) return;
      setDriving(false);
      setClockKey((k) => k + 1);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pathId, step]);

  /* The spotlight tracks its element — dialogs mount late, tables reflow —
     so the rectangle is re-measured every frame while the tour is up. */
  useEffect(() => {
    if (!open || !path) return;
    let raf = 0;
    const track = (): void => {
      const sel = path.steps[step]?.target;
      const el = sel ? document.querySelector(sel) : null;
      setRect((prev) => {
        if (!el) return prev === null ? prev : null;
        const next = el.getBoundingClientRect();
        return prev &&
          Math.abs(prev.top - next.top) < 1 &&
          Math.abs(prev.left - next.left) < 1 &&
          Math.abs(prev.width - next.width) < 1 &&
          Math.abs(prev.height - next.height) < 1
          ? prev
          : next;
      });
      raf = requestAnimationFrame(track);
    };
    raf = requestAnimationFrame(track);
    return () => cancelAnimationFrame(raf);
  }, [open, pathId, step, path]);

  const toChooser = useCallback(() => {
    runRef.current += 1; // orphan any in-flight drive
    setPathId(null);
    setStep(0);
    setRect(null);
    setDriving(false);
  }, []);

  const advance = useCallback(
    (to: number) => {
      if (to >= steps.length) {
        toChooser();
        return;
      }
      if (to < 0) {
        toChooser();
        return;
      }
      setStep(to);
    },
    [steps.length, toChooser],
  );

  const choosePath = (id: string): void => {
    setPathId(id);
    setStep(0);
    setPlaying(true);
  };

  /* Autoplay: the clock starts when the step has finished driving. */
  useEffect(() => {
    if (!open || !path || !current || !playing || driving) return;
    const t = setTimeout(() => advance(step + 1), current.holdMs);
    return () => clearTimeout(t);
  }, [open, path, playing, driving, step, current, advance]);

  useEffect(() => {
    if (!open) {
      setPathId(null);
      setStep(0);
      setPlaying(true);
    }
  }, [open]);

  if (!open) return null;

  const pad = 8;
  const hole =
    path && rect
      ? {
          top: Math.max(rect.top - pad, 0),
          left: Math.max(rect.left - pad, 0),
          width: Math.min(rect.width + pad * 2, window.innerWidth),
          height: Math.min(rect.height + pad * 2, window.innerHeight),
        }
      : /* No target (or the chooser): park the hole as a dot behind the card,
           so the scrim is whole and the card reads as the subject. */
        { top: window.innerHeight, left: window.innerWidth / 2, width: 0, height: 0 };

  return (
    <div className="rd-tour" role="dialog" aria-label="Guided tour" aria-live="polite">
      <div
        className="rd-tourhole"
        style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }}
      />
      {path === null || current === null ? (
        <div className="rd-tourcard">
          <div className="rd-tourcap">
            <div className="rd-tourtitle">Take the tour</div>
            <div className="rd-tourtext">
              Four paths, each driving the real app through one job — pick the one you came to
              learn. Everything a path does is demo data and resets on refresh.
            </div>
          </div>
          <div className="rd-tourpaths">
            {TOUR_PATHS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="rd-tourpath"
                onClick={() => choosePath(p.id)}
              >
                <span className="rd-tourpath-name">{p.title}</span>
                <span className="rd-tourpath-blurb">{p.blurb}</span>
              </button>
            ))}
          </div>
          <div className="rd-tourfoot">
            <span className="rd-tourcount">{TOUR_PATHS.length} paths</span>
            <span className="rd-tourclock" aria-hidden />
            <button type="button" className="rd-linkbtn rd-linkbtn-mut" onClick={onClose}>
              End tour
            </button>
          </div>
        </div>
      ) : (
        <div className="rd-tourcard">
          <div className="rd-tourcap">
            <div className="rd-tourtitle">{current.title}</div>
            <div className="rd-tourtext">{current.caption}</div>
          </div>
          <div className="rd-tourfoot">
            <span className="rd-tourcount">
              {step + 1} / {steps.length}
            </span>
            {playing && !driving ? (
              <span key={clockKey} className="rd-tourclock" aria-hidden>
                <span
                  className="rd-tourclock-fill"
                  style={{ animationDuration: `${current.holdMs}ms` }}
                />
              </span>
            ) : (
              <span className="rd-tourclock" aria-hidden />
            )}
            <button type="button" className="rd-chip rd-chip-sm" onClick={() => advance(step - 1)}>
              Back
            </button>
            <button
              type="button"
              className="rd-chip rd-chip-sm"
              onClick={() => setPlaying((p) => !p)}
            >
              {playing ? 'Pause' : 'Play'}
            </button>
            <button type="button" className="rd-btn-pri" onClick={() => advance(step + 1)}>
              {step === steps.length - 1 ? 'Finish' : 'Next'}
            </button>
            <button type="button" className="rd-linkbtn rd-linkbtn-mut" onClick={onClose}>
              End tour
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
