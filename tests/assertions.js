import assert from "node:assert/strict";
export { describe, it } from "node:test";
export function expect(value) {
  const match = {
    toBe: (expected) => assert.strictEqual(value, expected),
    toEqual: (expected) => assert.deepStrictEqual(value, expected),
    toHaveLength: (length) => assert.strictEqual(value.length, length),
    toContain: (expected) => assert.ok(value.includes(expected)),
    toHaveProperty: (key) => assert.ok(Object.hasOwn(value, key)),
    toThrow: (expected) =>
      assert.throws(
        value,
        (error) =>
          !expected ||
          (typeof expected === "string"
            ? error.message.includes(expected)
            : expected.test(error.message)),
      ),
  };
  match.not = {
    toHaveProperty: (key) => assert.ok(!Object.hasOwn(value, key)),
    toThrow: () => assert.doesNotThrow(value),
    toBe: (expected) => assert.notStrictEqual(value, expected),
  };
  return match;
}
