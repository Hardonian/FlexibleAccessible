import { describe, expect, it } from "vitest";
import {
  currentScheduleWindow,
  nextScheduleRunAt,
  parseSupportedScheduleCron,
  scheduleBlockedReason,
  scheduleCadenceLabel,
} from "./scheduled-crawl";

describe("scheduled crawl cadence", () => {
  it("parses supported cadence macros", () => {
    expect(parseSupportedScheduleCron("@daily")).toBe("@daily");
    expect(parseSupportedScheduleCron("@weekly")).toBe("@weekly");
    expect(parseSupportedScheduleCron("@monthly")).toBe("@monthly");
    expect(parseSupportedScheduleCron("0 0 * * *")).toBeNull();
  });

  it("computes daily windows in UTC", () => {
    const now = new Date("2026-04-08T14:21:00.000Z");
    const window = currentScheduleWindow("@daily", now);
    expect(window.slotStart.toISOString()).toBe("2026-04-08T00:00:00.000Z");
    expect(window.slotEnd.toISOString()).toBe("2026-04-09T00:00:00.000Z");
  });

  it("computes next run based on active window", () => {
    const now = new Date("2026-04-08T14:21:00.000Z");
    expect(nextScheduleRunAt("@weekly", now)?.toISOString()).toBe(
      "2026-04-12T00:00:00.000Z",
    );
    expect(nextScheduleRunAt(null, now)).toBeNull();
  });

  it("reports blocked reason for unsupported expression", () => {
    expect(scheduleBlockedReason("0 0 * * *")).toContain("not currently executable");
    expect(scheduleBlockedReason("@daily")).toBeNull();
    expect(scheduleCadenceLabel("@monthly")).toBe("Monthly");
    expect(scheduleCadenceLabel(null)).toBe("Off");
  });
});
