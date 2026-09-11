import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SlackMessage } from '../types';
import { formatDayShort } from '../logic/dates';
import { useApp } from '../ui/AppContext';
import { Card, CardHead, None, Page, Skeleton, Stack, Tag } from '../ui/rd';
import { useAsync } from '../ui/useAsync';

/**
 * What the Slack connection posts, shown as a feed.
 *
 * The owner, 7 Sep 2026: "there would be slack notifications connected to key
 * moments eg when something is due to approve or delay email needs writing."
 * Phase 1 records those messages here so the moments, channels and wording
 * are agreed on real behaviour before a webhook exists; phase 2 posts the
 * same objects to Slack and this screen becomes the audit trail.
 *
 * The three moments, each minted where the state actually changes:
 *   - due to approve   — a send lands in the approval queue inside the week
 *                        it goes out (plan submitted, or delay copy handed
 *                        back), mentioning the release's named approver;
 *   - delay email needs writing — a reschedule was logged, with the reason;
 *   - delay notice cancelled    — the one failure that used to flow nowhere.
 */

const KIND_LABEL: Record<SlackMessage['kind'], string> = {
  due_to_approve: 'Due to approve',
  delay_copy_requested: 'Delay email to write',
  delay_notice_cancelled: 'Delay notice cancelled',
};

export function SlackFeed(): ReactElement {
  const { data } = useApp();
  const navigate = useNavigate();
  const feed = useAsync(() => data.listSlackFeed(), []);

  return (
    <Page title="Slack notifications">
      <Stack>
        {feed.data === null ? (
          <Card>
            <Skeleton rows={6} />
          </Card>
        ) : feed.data.length === 0 ? (
          <Card>
            <CardHead title="Nothing yet" />
          </Card>
        ) : (
          <Card>
            <CardHead title={`${feed.data.length} messages`} />
            <div className="rd-slackfeed">
              {feed.data.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="rd-slackrow"
                  onClick={() =>
                    m.sendId ? navigate(`/sends/${m.sendId}`) : navigate(`/releases/${m.releaseId}`)
                  }
                >
                  <span className="rd-slackchan">{m.channel}</span>
                  <span className="rd-slackbody">
                    <span className="rd-slackhead">
                      <Tag
                        tone={
                          m.kind === 'delay_notice_cancelled'
                            ? 'clay'
                            : m.kind === 'due_to_approve'
                              ? 'sand'
                              : 'teal'
                        }
                      >
                        {KIND_LABEL[m.kind]}
                      </Tag>
                      {m.mention ? <span className="rd-slackmention">{m.mention}</span> : <None />}
                      <span className="rd-slackwhen">{formatDayShort(m.at.slice(0, 10))}</span>
                    </span>
                    <span className="rd-slacktext">{m.text}</span>
                  </span>
                </button>
              ))}
            </div>
          </Card>
        )}
      </Stack>
    </Page>
  );
}
