import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformTrainingModal } from "./platform-training-modal";

describe("PlatformTrainingModal", () => {
  it("renders the tour trigger button", () => {
    const markup = renderToStaticMarkup(<PlatformTrainingModal />);

    expect(markup).toContain("Platform Tour");
    expect(markup).toContain('aria-label="Platform Training and Quick Tour"');
  });

  it("is defined and exports a React component", () => {
    expect(PlatformTrainingModal).toBeDefined();
    expect(typeof PlatformTrainingModal).toBe("function");
  });
});
