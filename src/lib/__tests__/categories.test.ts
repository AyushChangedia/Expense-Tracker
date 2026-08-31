import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CATEGORY_ICONS,
  CATEGORY_KEYWORDS,
  DEFAULT_CATEGORIES,
  GRADIENT_PRESETS,
  ICON_NAMES,
  getCategoryIcon,
} from "@/lib/categories";

const HEX = /^#[0-9A-Fa-f]{6}$/;
const seededSlugs = new Set(DEFAULT_CATEGORIES.map((c) => c.slug));

/**
 * The catalogue is data, not logic, so what is worth testing is its
 * invariants. Every one of these breaks something concrete and silently: a
 * duplicate slug collides with the [userId, slug] unique constraint at
 * sign-up, a missing icon renders a fallback shape nobody chose, and a keyword
 * pointing at a slug that is not seeded makes the quick-add parser return a
 * category the account does not have.
 */

/* ------------------------------------------------------------- catalogue -- */

test("slugs are unique", () => {
  // A duplicate would violate [userId, slug] and fail the whole seed insert.
  assert.equal(seededSlugs.size, DEFAULT_CATEGORIES.length);
});

test("names are unique", () => {
  const names = DEFAULT_CATEGORIES.map((c) => c.name);
  assert.equal(new Set(names).size, names.length);
});

test("slugs are slug-shaped", () => {
  for (const category of DEFAULT_CATEGORIES) {
    assert.match(category.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, category.slug);
  }
});

test("every category has a kind the schema knows", () => {
  for (const category of DEFAULT_CATEGORIES) {
    assert.ok(
      ["INCOME", "EXPENSE", "BOTH"].includes(category.kind),
      `${category.slug} has kind ${category.kind}`,
    );
  }
});

test("the catalogue covers both sides of the ledger", () => {
  // An account seeded with no income categories cannot record a salary.
  const kinds = new Set(DEFAULT_CATEGORIES.map((c) => c.kind));
  assert.ok(kinds.has("EXPENSE"));
  assert.ok(kinds.has("INCOME"));
});

test("every gradient is a pair of six-digit hex colours", () => {
  // categorySchema rejects anything else, so a bad seed value would be
  // uneditable in the UI that validates against it.
  for (const category of DEFAULT_CATEGORIES) {
    assert.match(category.gradientFrom, HEX, `${category.slug} from`);
    assert.match(category.gradientTo, HEX, `${category.slug} to`);
  }
});

test("every preset gradient is valid and labelled", () => {
  for (const preset of GRADIENT_PRESETS) {
    assert.match(preset.from, HEX, preset.label);
    assert.match(preset.to, HEX, preset.label);
    assert.ok(preset.label.length > 0);
  }
  const labels = GRADIENT_PRESETS.map((p) => p.label);
  assert.equal(new Set(labels).size, labels.length, "duplicate preset labels");
});

/* ----------------------------------------------------------------- icons -- */

test("every seeded icon name resolves to a real icon", () => {
  for (const category of DEFAULT_CATEGORIES) {
    assert.ok(
      category.icon in CATEGORY_ICONS,
      `${category.slug} names the icon "${category.icon}", which is not in CATEGORY_ICONS`,
    );
  }
});

test("ICON_NAMES matches the icon map it advertises", () => {
  // The category editor offers this list; anything missing is unpickable.
  assert.deepEqual([...ICON_NAMES].sort(), Object.keys(CATEGORY_ICONS).sort());
});

test("getCategoryIcon falls back rather than returning undefined", () => {
  // It is rendered as <Icon />, so undefined would crash the row.
  assert.ok(getCategoryIcon("Wallet"));
  assert.ok(getCategoryIcon("NotAnIcon"));
  assert.ok(getCategoryIcon(null));
  assert.ok(getCategoryIcon(undefined));
  assert.ok(getCategoryIcon(""));
});

test("a known icon name returns that icon, not the fallback", () => {
  assert.equal(getCategoryIcon("Wallet"), CATEGORY_ICONS.Wallet);
  assert.notEqual(getCategoryIcon("Wallet"), getCategoryIcon("NotAnIcon"));
});

/* -------------------------------------------------------------- keywords -- */

test("every keyword group names a category that is actually seeded", () => {
  // The parser returns this slug as categorySlug; one that no account has
  // resolves to nothing and the transaction lands uncategorised.
  for (const slug of Object.keys(CATEGORY_KEYWORDS)) {
    assert.ok(seededSlugs.has(slug), `keywords reference "${slug}", which is not seeded`);
  }
});

test("keywords are lowercase, trimmed and non-empty", () => {
  // The parser matches against lowercased text, so an uppercase keyword can
  // never fire.
  for (const [slug, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      assert.equal(keyword, keyword.toLowerCase().trim(), `${slug}: "${keyword}"`);
      assert.ok(keyword.length > 0, `${slug} has an empty keyword`);
    }
  }
});

test("no keyword is listed twice within its own group", () => {
  for (const [slug, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    assert.equal(new Set(keywords).size, keywords.length, `${slug} repeats a keyword`);
  }
});

test("no keyword is claimed by two categories at once", () => {
  // Both would score identically on length and the winner would be whichever
  // Object.entries happened to reach first.
  const owner = new Map<string, string>();
  for (const [slug, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      const existing = owner.get(keyword);
      assert.equal(existing, undefined, `"${keyword}" is in both ${existing} and ${slug}`);
      owner.set(keyword, slug);
    }
  }
});

test("keywords contain no regex metacharacters that are not escaped upstream", () => {
  // The parser builds `new RegExp("\\b" + keyword + "\\b")`. It escapes them,
  // but a keyword needing escaping is a sign the list has drifted into
  // patterns rather than words.
  for (const [slug, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      assert.match(keyword, /^[a-z0-9 ]+$/, `${slug}: "${keyword}" is not a plain word`);
    }
  }
});
