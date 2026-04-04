import { afterEach, describe, expect, it } from "vitest";
import { getAppBaseUrl } from "./site-url";

const originalNextAuthUrl = process.env.NEXTAUTH_URL;
const originalVercelUrl = process.env.VERCEL_URL;
const originalPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (originalNextAuthUrl === undefined) {
    delete process.env.NEXTAUTH_URL;
  } else {
    process.env.NEXTAUTH_URL = originalNextAuthUrl;
  }

  if (originalVercelUrl === undefined) {
    delete process.env.VERCEL_URL;
  } else {
    process.env.VERCEL_URL = originalVercelUrl;
  }

  if (originalPublicAppUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = originalPublicAppUrl;
  }
});

describe("getAppBaseUrl", () => {
  it("prefers NEXT_PUBLIC_APP_URL when configured", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://flexibleaccessible.example/path";
    process.env.NEXTAUTH_URL = "https://app.aros.dev";
    process.env.VERCEL_URL = "preview.aros.dev";

    expect(getAppBaseUrl()).toBe("https://flexibleaccessible.example");
  });

  it("prefers NEXTAUTH_URL when NEXT_PUBLIC_APP_URL is missing", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXTAUTH_URL = "https://app.aros.dev/some/path?with=query";
    process.env.VERCEL_URL = "preview.aros.dev";

    expect(getAppBaseUrl()).toBe("https://app.aros.dev");
  });

  it("falls back to VERCEL_URL when NEXTAUTH_URL is missing", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXTAUTH_URL;
    process.env.VERCEL_URL = "preview.aros.dev";

    expect(getAppBaseUrl()).toBe("https://preview.aros.dev");
  });

  it("uses localhost fallback when env vars are missing", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXTAUTH_URL;
    delete process.env.VERCEL_URL;

    expect(getAppBaseUrl()).toBe("http://localhost:3000");
  });

  it("falls back when NEXTAUTH_URL is not a valid url", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXTAUTH_URL = "not-a-url";
    process.env.VERCEL_URL = "preview.aros.dev";

    expect(getAppBaseUrl()).toBe("https://preview.aros.dev");
  });

  it("falls back when NEXTAUTH_URL protocol is unsupported", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXTAUTH_URL = "ftp://app.aros.dev";
    delete process.env.VERCEL_URL;

    expect(getAppBaseUrl()).toBe("http://localhost:3000");
  });
});
