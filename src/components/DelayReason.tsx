import type { ReactElement } from 'react';
import type { DelayBrief } from '../types';
import { formatDayShort } from '../logic/dates';
import { useApp } from '../ui/AppContext';
import { Bar } from '../ui/rd';

/**
 * What the person who moved the date said, in their words, with their name on
 * it.
 *
 * The owner, 29 Aug 2026: *"When you're writing the email you should be able to
 * see the delay reason the person who delayed it wrote. The flow is: Warehouse
 * change date and delay write reason → Goes to CRM to write email."*
 *
 * The reason was already on the writer when he said that, and it read as app
 * copy: a blue advisory band, the same shape as the note two inches above it
 * saying whose queue this is, with the same sentence again inside the drafted
 * body below. Present, and not obviously anybody's.
 *
 * So two changes, and neither is about prominence. It is QUOTED, because these
 * are somebody else's words and quotation marks are how that is written down;
 * and it is SIGNED, because "the person who delayed it" is a person the writer
 * can go and ask, and a brief with no author is a brief with nobody to query.
 *
 * And it lives in one component because it belongs on three screens. The
 * writer needs it to write; the approver needs it to judge whether the copy
 * matches what happened; the send's own page is where anybody else goes to ask
 * "why did this go out?". Three copies of one bar is three chances to word the
 * handoff differently.
 */
export function DelayReason({ brief }: { brief: DelayBrief | undefined }): ReactElement | null {
  const { userName } = useApp();
  /* Absent only on a delay send minted before the brief existed. Nothing is
     drawn rather than a bar apologising for having nothing in it. */
  if (!brief) return null;
  return (
    <Bar tone="note" title="Why the date moved">
      “{brief.reason}”
      <div className="rd-barby">
        — {userName(brief.requestedBy)}, {formatDayShort(brief.requestedAt.slice(0, 10))}
      </div>
    </Bar>
  );
}
