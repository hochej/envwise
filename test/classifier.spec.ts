import { describe, expect, it } from "vitest";

import { classify, classifyEnv, classifyEnvForGondolin } from "../src";

function buildGithubPat(): string {
  return `ghp_${"A".repeat(36)}`;
}

describe("classifier MVP", () => {
  it("detects GitHub PAT by value and maps to GitHub host", () => {
    const result = classify("NOT_GITHUB_RELATED", buildGithubPat());

    expect(result.isSecret).toBe(true);
    expect(result.matchedBy).toBe("value");
    expect(result.patternId).toBe("github-pat");
    expect(result.hosts).toContain("api.github.com");
    expect(result.dropped).toBe(false);
  });

  it("prefers value-based match over name-based match", () => {
    const result = classify("STRIPE_API_KEY", buildGithubPat());

    expect(result.isSecret).toBe(true);
    expect(result.matchedBy).toBe("value");
    expect(result.patternId).toBe("github-pat");
    expect(result.hosts).toContain("api.github.com");
    expect(result.hosts).not.toContain("api.stripe.com");
  });

  it("uses exact-name mapping when present", () => {
    const result = classify("NODE_AUTH_TOKEN", "not-a-real-token");

    expect(result.isSecret).toBe(true);
    expect(result.matchedBy).toBe("name-exact");
    expect(result.hosts).toEqual(["registry.npmjs.org"]);
  });

  it("uses longest keyword match for name-based mapping", () => {
    const result = classify("SQUARESPACE_API_KEY", "placeholder");

    expect(result.isSecret).toBe(true);
    expect(result.matchedBy).toBe("name-keyword");
    expect(result.keyword).toBe("squarespace");
    expect(result.hosts).toEqual(["api.squarespace.com"]);
  });

  it("drops generic secret-like names when no host mapping exists", () => {
    const result = classify("CUSTOM_SECRET_TOKEN", "placeholder");

    expect(result.isSecret).toBe(true);
    expect(result.matchedBy).toBe("name-pattern");
    expect(result.dropped).toBe(true);
    expect(result.hosts).toEqual([]);
  });

  it("supports user overrides with highest precedence", () => {
    const result = classify("GITHUB_TOKEN", "non-secret", {
      overrides: {
        GITHUB_TOKEN: ["api.example.internal"],
      },
    });

    expect(result.isSecret).toBe(true);
    expect(result.matchedBy).toBe("override");
    expect(result.hosts).toEqual(["api.example.internal"]);
  });

  it("supports case-insensitive override lookup", () => {
    const result = classify("github_token", "non-secret", {
      overrides: {
        GITHUB_TOKEN: ["api.example.internal"],
      },
    });

    expect(result.isSecret).toBe(true);
    expect(result.matchedBy).toBe("override");
    expect(result.hosts).toEqual(["api.example.internal"]);
  });

  it("supports lowercase override keys for uppercase env names", () => {
    const result = classify("GITHUB_TOKEN", "non-secret", {
      overrides: {
        github_token: ["api.example.internal"],
      },
    });

    expect(result.isSecret).toBe(true);
    expect(result.matchedBy).toBe("override");
    expect(result.hosts).toEqual(["api.example.internal"]);
  });

  it("treats empty override hosts as dropped", () => {
    const result = classify("CUSTOM_API_KEY", "non-secret", {
      overrides: {
        CUSTOM_API_KEY: [],
      },
    });

    expect(result.isSecret).toBe(true);
    expect(result.matchedBy).toBe("override");
    expect(result.dropped).toBe(true);
    expect(result.hosts).toEqual([]);
  });

  it("classifyEnv splits secrets, dropped, and safe", () => {
    const env = {
      GITHUB_TOKEN: buildGithubPat(),
      CUSTOM_SECRET: "placeholder",
      PATH: "/usr/bin:/bin",
    };

    const result = classifyEnv(env);

    expect(result.secrets.map((r) => r.name)).toContain("GITHUB_TOKEN");
    expect(result.dropped.map((r) => r.name)).toContain("CUSTOM_SECRET");
    expect(result.safe).toContain("PATH");
  });

  it("builds gondolin-compatible secrets map", () => {
    const env = {
      GITHUB_TOKEN: buildGithubPat(),
      CUSTOM_SECRET: "placeholder",
      PATH: "/usr/bin:/bin",
    };

    const result = classifyEnvForGondolin(env);

    expect(Object.keys(result.secretsMap)).toEqual(["GITHUB_TOKEN"]);
    expect(result.secretsMap.GITHUB_TOKEN).toEqual({
      hosts: ["api.github.com"],
      value: env.GITHUB_TOKEN,
    });
    expect(result.dropped.map((r) => r.name)).toContain("CUSTOM_SECRET");
    expect(result.safe).toContain("PATH");
  });
});
