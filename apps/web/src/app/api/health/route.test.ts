import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import {
  collectPlatformHealth,
  toPublicHealthSummary,
} from "@aros/core-services";

// 1. Mock the core-services orchestrator functions
vi.mock("@aros/core-services", () => ({
  collectPlatformHealth: vi.fn(),
  toPublicHealthSummary: vi.fn(),
}));

describe("API Route: GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 200 OK when the platform orchestrator reports ready", async () => {
    // Arrange: Simulate a healthy platform state
    vi.mocked(collectPlatformHealth).mockResolvedValue({} as any);
    vi.mocked(toPublicHealthSummary).mockReturnValue({
      checkedAt: new Date().toISOString(),
      live: true,
      ready: true,
      readiness: "ready",
      installed: true,
      checks: {
        database: true,
        redis: true,
        session: true,
        worker: true,
        jobPipelines: true,
      },
    });

    // Act
    const response = await GET(
      new Request("http://localhost/api/health?detailed=true"),
    );
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data.ready).toBe(true);
    expect(data.readiness).toBe("ready");
    expect(collectPlatformHealth).toHaveBeenCalledOnce();
    expect(toPublicHealthSummary).toHaveBeenCalledOnce();
  });

  it("should return 503 Service Unavailable when the platform is degraded or unavailable", async () => {
    // Arrange: Simulate a missing database or failed Redis connection
    vi.mocked(collectPlatformHealth).mockResolvedValue({} as any);
    vi.mocked(toPublicHealthSummary).mockReturnValue({
      checkedAt: new Date().toISOString(),
      live: true,
      ready: false,
      readiness: "degraded",
      installed: true,
      checks: {
        database: false,
        redis: true,
        session: true,
        worker: true,
        jobPipelines: true,
      },
    });

    // Act
    const response = await GET(
      new Request("http://localhost/api/health?detailed=true"),
    );
    const data = await response.json();

    // Assert
    expect(response.status).toBe(503);
    expect(data.ready).toBe(false);
    expect(data.readiness).toBe("degraded");
  });
});
