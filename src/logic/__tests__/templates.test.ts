import { describe, expect, it } from 'vitest';
import { patchTokens, renderForRecipient, renderTemplate } from '../templates';

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

describe('renderTemplate', () => {
  it('renders subject and body with patched fields', () => {
    const { subject, body } = renderTemplate('pp-delay', {
      artist: 'Jenny Marlowe',
      release_title: 'Falling Light',
      promise_date: '30 October 2026',
      old_promise_date: '12 September 2026',
      reason_line: 'The framing run failed quality checks.',
    });
    expect(subject).toBe('An update on your Falling Light delivery date');
    expect(body).toContain('The framing run failed quality checks.');
    expect(body).toContain('previously expected by 12 September 2026');
    expect(body).toContain('updated delivery date is 30 October 2026');
    expect(body).toContain('{{first_name}}'); // survives until per-recipient render
  });
});

describe('renderForRecipient', () => {
  it('uses the collector first name', () => {
    expect(renderForRecipient('Hi {{first_name}},', 'Jane Smith')).toBe('Hi Jane,');
  });

  it('falls back gracefully for empty names', () => {
    expect(renderForRecipient('Hi {{first_name}},', '  ')).toBe('Hi there,');
  });
});
