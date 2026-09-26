import { describe, expect, it } from "vitest";
import { appUrl, assetUrl, scannedRecordRoute } from "../src/data/urls";

describe("GitHub Pages URLs", () => {
  const project = new URL("https://community.github.io/mahal/");
  it("preserves project paths in receipt and profile QR links", () => {
    expect(appUrl("/receipt/payment-1", project)).toBe(
      "https://community.github.io/mahal/#/receipt/payment-1",
    );
    expect(
      scannedRecordRoute(appUrl("/p/member/M-000001", project), project),
    ).toBe("/p/member/M-000001");
  });
  it("supports root sites and custom domains", () => {
    const root = new URL("https://mahal.example/");
    expect(appUrl("/p/house/H-000001", root)).toBe(
      "https://mahal.example/#/p/house/H-000001",
    );
    expect(scannedRecordRoute(appUrl("/receipt/payment-1", root), root)).toBe(
      "/receipt/payment-1",
    );
  });
  it("rejects foreign sites, other repositories and non-record QR routes", () => {
    for (const url of [
      "https://elsewhere.example/mahal/#/p/member/M-000001",
      "https://community.github.io/other/#/receipt/one",
      "https://community.github.io/mahal/#/admin",
      "https://community.github.io/mahal/#/p/member/../../admin",
    ])
      expect(() => scannedRecordRoute(url, project)).toThrow(
        "not a Mahal record",
      );
  });
  it("loads bundled logos inside the repository and preserves full URLs", () => {
    expect(assetUrl("/mahal-logo.png", project)).toBe(
      "https://community.github.io/mahal/mahal-logo.png",
    );
    expect(assetUrl("https://assets.example/logo.png", project)).toBe(
      "https://assets.example/logo.png",
    );
  });
});
