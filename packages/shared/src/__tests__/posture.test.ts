import { describe, expect, it } from "vitest";
import {
  calculateHealthScore,
  SystemPosture,
  ComponentPosture,
} from "../posture.js";

describe("calculateHealthScore", () => {
  const createBaseSystemPosture = (
    components: ComponentPosture[] = [],
    overall: SystemPosture["overall"] = "healthy",
    reasonCodes: string[] = [],
    degradedReasons: string[] = [],
  ): SystemPosture => ({
    overall,
    summary: "Test summary",
    reasonCodes,
    components,
    degraded: overall === "degraded",
    degradedReasons,
    failClosed: true,
    checkedAt: new Date().toISOString(),
  });

  let idCounter = 0;

  const createComponent = (
    level: ComponentPosture["level"],
  ): ComponentPosture => ({
    id: `comp-${++idCounter}`,
    name: "Test Component",
    level,
    state: level === "healthy" ? "healthy" : "unknown",
    reasonCodes: [],
    detail: "Test detail",
    checkedAt: new Date().toISOString(),
    stale: false,
  });

  it("returns 100 for all healthy components", () => {
    const posture = createBaseSystemPosture([
      createComponent("healthy"),
      createComponent("healthy"),
    ]);
    const result = calculateHealthScore(posture);
    expect(result.score).toBe(100);
    expect(result.level).toBe("healthy");
    expect(result.primaryReason).toBe("NO_ISSUES");
    expect(result.explanation).toEqual([]);
  });

  it("returns 0 for all unhealthy components", () => {
    const posture = createBaseSystemPosture(
      [createComponent("unhealthy"), createComponent("unhealthy")],
      "unhealthy",
    );
    const result = calculateHealthScore(posture);
    expect(result.score).toBe(0);
    expect(result.level).toBe("unhealthy");
  });

  it("returns 50 for all degraded components", () => {
    const posture = createBaseSystemPosture(
      [createComponent("degraded"), createComponent("degraded")],
      "degraded",
    );
    const result = calculateHealthScore(posture);
    expect(result.score).toBe(50);
  });

  it("returns 25 for all unknown components", () => {
    const posture = createBaseSystemPosture(
      [createComponent("unknown"), createComponent("unknown")],
      "unknown",
    );
    const result = calculateHealthScore(posture);
    expect(result.score).toBe(25);
  });

  it("calculates average score correctly (mixed components)", () => {
    const posture = createBaseSystemPosture(
      [
        createComponent("healthy"), // 100
        createComponent("degraded"), // 50
        createComponent("unhealthy"), // 0
        createComponent("unknown"), // 25
      ],
      "degraded",
    );
    const result = calculateHealthScore(posture);
    // (100 + 50 + 0 + 25) / 4 = 175 / 4 = 43.75 -> rounded to 44
    expect(result.score).toBe(44);
  });

  it("returns 0 for empty components array", () => {
    const posture = createBaseSystemPosture([]);
    const result = calculateHealthScore(posture);
    expect(result.score).toBe(0);
  });

  it("uses first reasonCode as primaryReason or defaults to NO_ISSUES", () => {
    const postureWithReason = createBaseSystemPosture([], "degraded", [
      "API_TIMEOUT",
      "DB_SLOW",
    ]);
    expect(calculateHealthScore(postureWithReason).primaryReason).toBe(
      "API_TIMEOUT",
    );

    const postureNoReason = createBaseSystemPosture([], "healthy", []);
    expect(calculateHealthScore(postureNoReason).primaryReason).toBe(
      "NO_ISSUES",
    );
  });

  it("correctly maps degradedReasons to explanation", () => {
    const explanations = ["API is slow", "Database connection timeout"];
    const posture = createBaseSystemPosture([], "degraded", [], explanations);
    expect(calculateHealthScore(posture).explanation).toEqual(explanations);
  });

  it("handles unhandled levels as 0", () => {
    const posture = createBaseSystemPosture([
      // @ts-expect-error - testing invalid level
      createComponent("invalid"),
    ]);
    const result = calculateHealthScore(posture);
    expect(result.score).toBe(0);
  });
});
