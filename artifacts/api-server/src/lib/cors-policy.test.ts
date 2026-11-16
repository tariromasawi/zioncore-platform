import assert from "node:assert/strict";
import { test } from "node:test";
import { isAllowedCorsOrigin, parseAllowedCorsOrigins } from "./cors-policy";

test("an empty origin allowlist does not emit cross-origin permission", () => {
  const allowed = parseAllowedCorsOrigins(undefined);
  assert.equal(isAllowedCorsOrigin(undefined, allowed), false);
  assert.equal(
    isAllowedCorsOrigin("https://unapproved.example", allowed),
    false,
  );
});

test("only exact configured origins are allowed", () => {
  const allowed = parseAllowedCorsOrigins(
    "https://zioncore.example, http://localhost:5173",
  );
  assert.equal(isAllowedCorsOrigin("https://zioncore.example", allowed), true);
  assert.equal(isAllowedCorsOrigin("http://localhost:5173", allowed), true);
  assert.equal(
    isAllowedCorsOrigin("https://sub.zioncore.example", allowed),
    false,
  );
  assert.equal(
    isAllowedCorsOrigin("https://zioncore.example.attacker.test", allowed),
    false,
  );
});

test("wildcards, paths, credentials, and non-HTTP origins are rejected", () => {
  for (const value of [
    "*",
    "https://zioncore.example/path",
    "https://user:password@zioncore.example",
    "file://zioncore.example",
    "not a url",
  ]) {
    assert.throws(() => parseAllowedCorsOrigins(value), /CORS_ALLOWED_ORIGINS/);
  }
});
