import { describe, expect, it } from "vitest";
import { dateToZonedInput, dayKey, formatSigned, initialsOf, zonedInputToDate } from "@/lib/format";
import { createTranslator, pickText } from "@/lib/i18n/core";
import { suggestUsername, usernameFromName, USERNAME_PATTERN } from "@/lib/validation";

describe("time zones", () => {
  it("reads a local date-time in the club's zone, summer and winter", () => {
    expect(zonedInputToDate("2026-07-25T10:00", "Europe/Amsterdam")?.toISOString()).toBe("2026-07-25T08:00:00.000Z");
    expect(zonedInputToDate("2026-12-05T10:00", "Europe/Amsterdam")?.toISOString()).toBe("2026-12-05T09:00:00.000Z");
    expect(zonedInputToDate("nonsense")).toBeNull();
  });

  it("round-trips through the input format", () => {
    const instant = new Date("2026-07-25T08:00:00.000Z");
    expect(dateToZonedInput(instant, "Europe/Amsterdam")).toBe("2026-07-25T10:00");
    expect(zonedInputToDate(dateToZonedInput(instant, "Europe/Amsterdam"), "Europe/Amsterdam")?.getTime()).toBe(instant.getTime());
  });

  it("keys a day by the local calendar date", () => {
    expect(dayKey("2026-07-25T22:30:00.000Z", "Europe/Amsterdam")).toBe("2026-07-26");
    expect(dayKey("2026-07-25T22:30:00.000Z", "UTC")).toBe("2026-07-25");
  });
});

describe("text helpers", () => {
  it("builds initials from first and last name", () => {
    expect(initialsOf("Sanne de Vries")).toBe("SV");
    expect(initialsOf("Luc")).toBe("L");
    expect(initialsOf("  ")).toBe("?");
  });

  it("signs averages relative to par", () => {
    expect(formatSigned(1.44, "nl")).toBe("+1,4");
    expect(formatSigned(-0.6, "en")).toBe("−0.6");
    expect(formatSigned(0.04, "en")).toBe("0.0");
  });

  it("generates usernames the database accepts", () => {
    expect(usernameFromName("Sanne de Vries", "FW-K7M2QX")).toBe("sannedevries-m2qx");
    expect(usernameFromName("Ærø Ünïcode", "FW-AB")).toMatch(USERNAME_PATTERN);
    expect(usernameFromName("!!!", "x")).toBe("speler-000x");
    expect(suggestUsername("Sanne de Vries")).toBe("sanne.devries");
    expect(suggestUsername("José")).toBe("jose");
  });
});

describe("i18n core", () => {
  const messages = {
    greeting: "Hallo {name}",
    rounds: { one: "{count} ronde", other: "{count} rondes" },
    nested: { deep: { label: "Diep" } },
  };
  const t = createTranslator(messages, "nl");

  it("interpolates, pluralises and resolves nested keys", () => {
    expect(t("greeting", { name: "Sanne" })).toBe("Hallo Sanne");
    expect(t("rounds", { count: 1 })).toBe("1 ronde");
    expect(t("rounds", { count: 4 })).toBe("4 rondes");
    expect(t("nested.deep.label")).toBe("Diep");
  });

  it("falls back to the key for unknown messages", () => {
    expect((t as (key: string) => string)("missing.key")).toBe("missing.key");
  });

  it("picks stored text by locale with fallbacks", () => {
    expect(pickText({ nl: "Baan", en: "Course" }, "en")).toBe("Course");
    expect(pickText({ nl: "Baan" }, "en")).toBe("Baan");
    expect(pickText(null, "nl", "geen")).toBe("geen");
  });
});
