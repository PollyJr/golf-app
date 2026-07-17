import { describe, expect, it } from "vitest";
import { normalizeUsername, usernameFromDisplayName, usernamePattern } from "./player-core";

describe("player usernames", () => {
  it("creates a searchable username from a display name", () => {
    expect(usernameFromDisplayName("Söma de Vries", "AB12")).toBe("somadevries-ab12");
  });

  it("normalizes and validates editable usernames", () => {
    expect(normalizeUsername("  Polly.Golf  ")).toBe("polly.golf");
    expect(usernamePattern.test("polly.golf")).toBe(true);
    expect(usernamePattern.test("geen spaties")).toBe(false);
  });
});
