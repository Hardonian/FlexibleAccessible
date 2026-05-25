import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  createVerificationAttempt,
  recordEvidence,
  VerificationAttempt,
  VerificationTarget,
} from "../verification.js";

describe("verification", () => {
  describe("recordEvidence", () => {
    const target: VerificationTarget = {
      type: "artifact",
      id: "tgt-123",
    };

    let baseAttempt: VerificationAttempt;

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2023-01-01T12:00:00Z"));

      baseAttempt = createVerificationAttempt(target, "automated", "user-1", "trace-1");
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("successfully adds evidence and updates chain of custody", () => {
      const evidenceData = {
        kind: "screenshot",
        source: "agent",
        data: { url: "http://example.com/screenshot.png" },
      };

      vi.setSystemTime(new Date("2023-01-01T12:05:00Z"));
      const attemptWithEvidence = recordEvidence(baseAttempt, evidenceData);

      expect(attemptWithEvidence.evidence).toHaveLength(1);

      const addedEvidence = attemptWithEvidence.evidence[0];
      expect(addedEvidence.kind).toBe("screenshot");
      expect(addedEvidence.source).toBe("agent");
      expect(addedEvidence.data).toEqual(evidenceData.data);
      expect(addedEvidence.id).toMatch(/^ev_\d+_[a-f0-9]+$/);
      expect(addedEvidence.collectedAt).toBe("2023-01-01T12:05:00.000Z");

      expect(attemptWithEvidence.chainOfCustody).toHaveLength(2);
      const newChainEntry = attemptWithEvidence.chainOfCustody[1];
      expect(newChainEntry.action).toBe("evidence_recorded");
      expect(newChainEntry.actor).toBe("user-1");
      expect(newChainEntry.traceId).toBe("trace-1");
      expect(newChainEntry.timestamp).toBe("2023-01-01T12:05:00.000Z");
      expect(newChainEntry.metadata?.evidenceId).toBe(addedEvidence.id);
    });

    it("uses provided opts to override performedBy and traceId", () => {
      const evidenceData = {
        kind: "log",
        source: "system",
        data: { message: "test log" },
      };

      const attemptWithEvidence = recordEvidence(baseAttempt, evidenceData, {
        performedBy: "admin-1",
        traceId: "trace-admin-1",
      });

      expect(attemptWithEvidence.chainOfCustody).toHaveLength(2);
      const newChainEntry = attemptWithEvidence.chainOfCustody[1];
      expect(newChainEntry.action).toBe("evidence_recorded");
      expect(newChainEntry.actor).toBe("admin-1");
      expect(newChainEntry.traceId).toBe("trace-admin-1");
    });

    it("preserves existing evidence and chain of custody entries", () => {
      const evidenceData1 = { kind: "e1", source: "s1", data: {} };
      const evidenceData2 = { kind: "e2", source: "s2", data: {} };

      const attempt1 = recordEvidence(baseAttempt, evidenceData1);
      const attempt2 = recordEvidence(attempt1, evidenceData2);

      expect(attempt2.evidence).toHaveLength(2);
      expect(attempt2.evidence[0].kind).toBe("e1");
      expect(attempt2.evidence[1].kind).toBe("e2");

      expect(attempt2.chainOfCustody).toHaveLength(3);
      expect(attempt2.chainOfCustody[0].action).toBe("verification_initiated");
      expect(attempt2.chainOfCustody[1].action).toBe("evidence_recorded");
      expect(attempt2.chainOfCustody[2].action).toBe("evidence_recorded");
    });
  });
});
