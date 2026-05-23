import { describe, expect, it } from 'vitest';
import { getEmailOutboundSummary } from '../email';

describe('getEmailOutboundSummary', () => {
  it('returns none when unset', () => {
    const s = getEmailOutboundSummary({});
    expect(s.configured).toBe(false);
    expect(s.mode).toBe('none');
    expect(s.hostSet).toBe(false);
    expect(s.fromSet).toBe(false);
  });

  it('returns smtp when host port and from set without auth', () => {
    const s = getEmailOutboundSummary({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      EMAIL_FROM: 'noreply@example.com',
    });
    expect(s.configured).toBe(true);
    expect(s.mode).toBe('smtp');
    expect(s.hostSet).toBe(true);
    expect(s.fromSet).toBe(true);
  });

  it('requires both user and pass when one is set', () => {
    const s1 = getEmailOutboundSummary({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_USER: 'u',
      EMAIL_FROM: 'noreply@example.com',
    });
    expect(s1.configured).toBe(false);
    expect(s1.mode).toBe('none');
    expect(s1.hostSet).toBe(true);
    expect(s1.fromSet).toBe(true);

    const s2 = getEmailOutboundSummary({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_PASS: 'p',
      EMAIL_FROM: 'noreply@example.com',
    });
    expect(s2.configured).toBe(false);
    expect(s2.mode).toBe('none');
    expect(s2.hostSet).toBe(true);
    expect(s2.fromSet).toBe(true);
  });

  it('returns smtp when fully configured with auth', () => {
    const s = getEmailOutboundSummary({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_USER: 'user',
      SMTP_PASS: 'pass',
      EMAIL_FROM: 'noreply@example.com',
    });
    expect(s.configured).toBe(true);
    expect(s.mode).toBe('smtp');
    expect(s.hostSet).toBe(true);
    expect(s.fromSet).toBe(true);
  });

  it('treats empty or whitespace-only strings as unset', () => {
    const s = getEmailOutboundSummary({
      SMTP_HOST: '   ',
      SMTP_PORT: ' ',
      SMTP_USER: '',
      SMTP_PASS: '  ',
      EMAIL_FROM: ' ',
    });
    expect(s.configured).toBe(false);
    expect(s.mode).toBe('none');
    expect(s.hostSet).toBe(false);
    expect(s.fromSet).toBe(false);
  });

  it('fails if host is missing', () => {
    const s = getEmailOutboundSummary({
      SMTP_PORT: '587',
      SMTP_USER: 'user',
      SMTP_PASS: 'pass',
      EMAIL_FROM: 'noreply@example.com',
    });
    expect(s.configured).toBe(false);
    expect(s.hostSet).toBe(false);
  });

  it('fails if port is missing', () => {
    const s = getEmailOutboundSummary({
      SMTP_HOST: 'smtp.example.com',
      SMTP_USER: 'user',
      SMTP_PASS: 'pass',
      EMAIL_FROM: 'noreply@example.com',
    });
    expect(s.configured).toBe(false);
    expect(s.hostSet).toBe(true);
  });

  it('fails if from is missing', () => {
    const s = getEmailOutboundSummary({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_USER: 'user',
      SMTP_PASS: 'pass',
    });
    expect(s.configured).toBe(false);
    expect(s.fromSet).toBe(false);
  });
});
