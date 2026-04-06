import { describe, expect, it } from 'vitest';
import { getEmailOutboundSummary } from '../email';

describe('getEmailOutboundSummary', () => {
  it('returns none when unset', () => {
    const s = getEmailOutboundSummary({});
    expect(s.configured).toBe(false);
    expect(s.mode).toBe('none');
  });

  it('returns smtp when host port and from set without auth', () => {
    const s = getEmailOutboundSummary({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      EMAIL_FROM: 'noreply@example.com',
    });
    expect(s.configured).toBe(true);
    expect(s.mode).toBe('smtp');
  });

  it('requires both user and pass when one is set', () => {
    const s = getEmailOutboundSummary({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_USER: 'u',
      EMAIL_FROM: 'noreply@example.com',
    });
    expect(s.configured).toBe(false);
  });
});
