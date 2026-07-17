import { describe, expect, it } from "vitest";
import { assertSameOrigin, externalOrigin, hashSecret, SecurityError, verifySecret } from "./security-core";

describe("credential hashing", () => {
  it("verifies only the correct secret", async () => {
    const encoded = await hashSecret("482193");
    expect(encoded).not.toContain("482193");
    expect(await verifySecret("482193", encoded)).toBe(true);
    expect(await verifySecret("482194", encoded)).toBe(false);
  });
});

describe("origin validation", () => {
  it("accepts the forwarded Railway origin", () => {
    const request = new Request("http://internal/api", { headers: { origin: "https://golf.example", host: "internal", "x-forwarded-host": "golf.example", "x-forwarded-proto": "https" } });
    expect(() => assertSameOrigin(request)).not.toThrow();
    expect(externalOrigin(request)).toBe("https://golf.example");
  });

  it("rejects cross-site mutations", () => {
    const request = new Request("https://golf.example/api", { headers: { origin: "https://attacker.example", host: "golf.example" } });
    expect(() => assertSameOrigin(request)).toThrowError(SecurityError);
  });
});
