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
    const s = getEmailOutboundSummary({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_USER: 'u',
      EMAIL_FROM: 'noreply@example.com',
    });
    expect(s.configured).toBe(false);
    expect(s.mode).toBe('none');
    expect(s.hostSet).toBe(true);
    expect(s.fromSet).toBe(true);
  });

  it('requires both user and pass when pass is set', () => {
    const s = getEmailOutboundSummary({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_PASS: 'p',
      EMAIL_FROM: 'noreply@example.com',
    });
    expect(s.configured).toBe(false);
  });

  it('returns smtp when host, port, user, pass, and from are all set', () => {
    const s = getEmailOutboundSummary({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_USER: 'u',
      SMTP_PASS: 'p',
      EMAIL_FROM: 'noreply@example.com',
    });
    expect(s.configured).toBe(true);
    expect(s.mode).toBe('smtp');
  });

  it('is not configured when from is missing', () => {
    const s = getEmailOutboundSummary({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
    });
    expect(s.configured).toBe(false);
    expect(s.fromSet).toBe(false);
  });

  it('is not configured when host is missing', () => {
    const s = getEmailOutboundSummary({
      SMTP_PORT: '587',
      EMAIL_FROM: 'noreply@example.com',
    });
    expect(s.configured).toBe(false);
    expect(s.hostSet).toBe(false);
  });

  it('is not configured when port is missing', () => {
    const s = getEmailOutboundSummary({
      SMTP_HOST: 'smtp.example.com',
      EMAIL_FROM: 'noreply@example.com',
    });
    expect(s.configured).toBe(false);
    expect(s.hostSet).toBe(true);
  });

  it('handles whitespace values as unset', () => {
    const s = getEmailOutboundSummary({
      SMTP_HOST: '   ',
      SMTP_PORT: ' \t ',
      SMTP_USER: '\n',
      SMTP_PASS: ' ',
      EMAIL_FROM: '   ',
    });
    expect(s.configured).toBe(false);
    expect(s.hostSet).toBe(false);
    expect(s.fromSet).toBe(false);
  });
});
