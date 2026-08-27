import { test } from "node:test";
import assert from "node:assert/strict";

import { round2, sum } from "@/lib/utils";

/**
 * Proves the harness itself works: node:test runs, assertions fire, and the
 * `@/*` alias resolves through tsx exactly as it does through Next.
 */
test("the harness runs and resolves the @/ alias", () => {
  assert.equal(round2(1.005), 1.01);
  assert.equal(sum([1, 2, 3]), 6);
});
