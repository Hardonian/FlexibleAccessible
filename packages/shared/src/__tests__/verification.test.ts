import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isVerificationValid,
  VerificationAttempt,
  DEFAULT_VERIFICATION_CONFIG,
} from "../verification";

describe("isVerificationValid", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const baseAttempt: Partial<VerificationAttempt> = {
    id: "test-attempt",
    status: "passed",
  };

  it("should return false if status is not passed", () => {
    const attempt = { ...baseAttempt, status: "failed" } as VerificationAttempt;
    expect(isVerificationValid(attempt)).toBe(false);

    const pendingAttempt = {
      ...baseAttempt,
      status: "pending",
    } as VerificationAttempt;
    expect(isVerificationValid(pendingAttempt)).toBe(false);
  });

  it("should return false if completedAt is missing", () => {
    const attempt = { ...baseAttempt, status: "passed" } as VerificationAttempt; // no completedAt
    expect(isVerificationValid(attempt)).toBe(false);
  });

  it("should return true if verification is valid and not expired (default config)", () => {
    const now = new Date("2023-01-01T12:00:00Z");
    vi.setSystemTime(now);

    const attempt = {
      ...baseAttempt,
      status: "passed",
      completedAt: "2023-01-01T10:00:00Z", // 2 hours ago
    } as VerificationAttempt;

    expect(isVerificationValid(attempt)).toBe(true);
  });

  it("should return false if verification has expired (default config)", () => {
    const now = new Date("2023-01-03T12:00:00Z");
    vi.setSystemTime(now);

    const attempt = {
      ...baseAttempt,
      status: "passed",
      completedAt: "2023-01-01T10:00:00Z", // 2 days ago, default expiration is 24h
    } as VerificationAttempt;

    expect(isVerificationValid(attempt)).toBe(false);
  });

  it("should return true if verification is valid based on custom config", () => {
    const now = new Date("2023-01-03T12:00:00Z");
    vi.setSystemTime(now);

    const attempt = {
      ...baseAttempt,
      status: "passed",
      completedAt: "2023-01-01T10:00:00Z", // 2 days ago
    } as VerificationAttempt;

    // Custom config with 3 days expiration (72 hours)
    const customConfig = { expirationMs: 72 * 60 * 60 * 1000 };
    expect(isVerificationValid(attempt, customConfig)).toBe(true);
  });

  it("should return false if verification has expired based on custom config", () => {
    const now = new Date("2023-01-01T12:00:00Z");
    vi.setSystemTime(now);

    const attempt = {
      ...baseAttempt,
      status: "passed",
      completedAt: "2023-01-01T10:00:00Z", // 2 hours ago
    } as VerificationAttempt;

    // Custom config with 1 hour expiration
    const customConfig = { expirationMs: 60 * 60 * 1000 };
    expect(isVerificationValid(attempt, customConfig)).toBe(false);
  });
});
