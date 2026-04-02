import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LoginForm } from "./login-form";

describe("LoginForm", () => {
  it("should render the login form", () => {
    const markup = renderToStaticMarkup(<LoginForm />);

    expect(markup).toContain('for="email"');
    expect(markup).toContain('Email address');
    expect(markup).toContain('for="password"');
    expect(markup).toContain('Password');
    expect(markup).toContain("Sign in");
  });
});
