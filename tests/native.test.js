import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loginCredentials } from "../domain/credentials.js";
import { parseCsv } from "../domain/csv.js";
import { csvString } from "../lib/csv-export.js";
import { routeInfo } from "../lib/router.js";
import qrcodegen from "../vendor/qrcodegen.js";
import decode from "../vendor/jsqr.js";
describe("native module infrastructure", () => {
  it("maps a user ID to synthetic email and appends fixed padding without collisions", () => {
    const options = {
      userId: "admin",
      emailDomain: "users.example.invalid",
      emailOverride: "",
      passwordSuffix: "::TMJ-v1",
    };
    assert.deepEqual(loginCredentials(" Admin ", "1234", options), {
      email: "admin@users.example.invalid",
      password: "1234::TMJ-v1",
    });
    assert.notEqual(
      loginCredentials("admin", "123", options).password,
      loginCredentials("admin", "1230", options).password,
    );
    assert.throws(() => loginCredentials("someone-else", "1234", options));
    assert.throws(() => loginCredentials("admin", "", options));
    assert.equal(
      loginCredentials("admin", "secret", {
        ...options,
        emailOverride: "owner@example.com",
        passwordSuffix: "",
      }).email,
      "owner@example.com",
    );
  });
  it("parses multiline CSV, escaped quotes, Malayalam and leading zeros", () => {
    const data = [{ name: 'നൂർ, "വീട്"\nRoad', id: "001", phone: "090000001" }];
    assert.deepEqual(parseCsv(csvString(data)).rows, data);
    assert.throws(() => parseCsv('id,name\n1,"unclosed'));
    assert.throws(() => parseCsv("id,id\n1,2"));
    assert.throws(() => parseCsv("id,name\n1,2,3"));
    assert.ok(csvString([{ name: "=HYPERLINK(x)" }]).includes("'=HYPERLINK"));
    assert.equal(parseCsv(csvString([{ amount: -12.5 }])).rows[0].amount, "-12.5");
  });
  it("routes hash links and query parameters without server rewriting", () => {
    const route = routeInfo("#/admin/receive?payer=M-000001");
    assert.equal(route.path, "/admin/receive");
    assert.equal(route.params.get("payer"), "M-000001");
    assert.equal(routeInfo("").path, "/");
  });
  it("generates a decodable real QR for a GitHub Pages verification URL", () => {
    const text =
        "https://shamilvakkaloor.github.io/TMJ---Accounts/#/receipt/test-123",
      code = qrcodegen.QrCode.encodeText(text, qrcodegen.QrCode.Ecc.MEDIUM),
      scale = 5,
      size = (code.size + 8) * scale,
      pixels = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const black = code.getModule(
            Math.floor(x / scale) - 4,
            Math.floor(y / scale) - 4,
          ),
          index = (y * size + x) * 4;
        pixels[index] = pixels[index + 1] = pixels[index + 2] = black ? 0 : 255;
        pixels[index + 3] = 255;
      }
    assert.equal(decode(pixels, size, size)?.data, text);
  });
});
