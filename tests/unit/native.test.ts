import { describe, expect, it } from "vitest";
import { androidIntentUrl, devicePlatform, isAndroidApp } from "@/lib/native";

const PIXEL = "Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const IPAD = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";

describe("devicePlatform", () => {
  it("recognises the Fairway app before plain Android", () => {
    expect(devicePlatform(`${PIXEL} FairwayAndroid/2.1.0-debug`)).toBe("app");
    expect(isAndroidApp(`${PIXEL} FairwayAndroid/2.1.0-debug`)).toBe(true);
    expect(devicePlatform(PIXEL)).toBe("android");
  });

  it("recognises iPhones and iPads, also when the iPad says it is a Mac", () => {
    expect(devicePlatform(IPHONE)).toBe("ios");
    expect(devicePlatform(IPAD)).toBe("ios");
  });

  it("treats everything else as a desktop", () => {
    expect(devicePlatform(MAC)).toBe("desktop");
    expect(devicePlatform(null)).toBe("desktop");
  });
});

describe("androidIntentUrl", () => {
  it("opens the same https link in the app and falls back to the browser", () => {
    const url = androidIntentUrl("https://golf.example/live/abc123?x=1", "https://golf.example/live/abc123?install=1");
    expect(url).toBe(
      "intent://golf.example/live/abc123?x=1#Intent;scheme=https;package=club.fairway.app;" +
        "S.browser_fallback_url=https%3A%2F%2Fgolf.example%2Flive%2Fabc123%3Finstall%3D1;end",
    );
  });
});
