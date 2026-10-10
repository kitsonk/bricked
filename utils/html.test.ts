import { expect, test } from "vitest";
import { decodeHtml } from "@/utils/html.ts";

// ---------------------------------------------------------------------------
// Decimal numeric references
// ---------------------------------------------------------------------------

test("decodeHtml: decodes decimal numeric references", () => {
  expect(decodeHtml("&#40;")).toEqual("(");
  expect(decodeHtml("&#41;")).toEqual(")");
  expect(decodeHtml("&#38;")).toEqual("&");
});

test("decodeHtml: decodes multiple decimal references in one string", () => {
  expect(decodeHtml("Plate&#44; Round 1&#47;2&#34;")).toEqual('Plate, Round 1/2"');
});

// ---------------------------------------------------------------------------
// Hex numeric references
// ---------------------------------------------------------------------------

test("decodeHtml: decodes lowercase hex numeric references", () => {
  expect(decodeHtml("&#x28;")).toEqual("(");
  expect(decodeHtml("&#x26;")).toEqual("&");
});

test("decodeHtml: decodes uppercase hex numeric references", () => {
  expect(decodeHtml("&#X28;")).toEqual("(");
  expect(decodeHtml("&#X2F;")).toEqual("/");
});

// ---------------------------------------------------------------------------
// Named character references
// ---------------------------------------------------------------------------

test("decodeHtml: decodes &amp;", () => {
  expect(decodeHtml("Brick &amp; Mortar")).toEqual("Brick & Mortar");
});

test("decodeHtml: decodes &lt; and &gt;", () => {
  expect(decodeHtml("&lt;3&gt;")).toEqual("<3>");
});

test("decodeHtml: decodes &quot;", () => {
  expect(decodeHtml("2&quot; Plate")).toEqual('2" Plate');
});

test("decodeHtml: decodes &apos;", () => {
  expect(decodeHtml("it&apos;s")).toEqual("it's");
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test("decodeHtml: returns plain strings unchanged", () => {
  expect(decodeHtml("Brick 1x2")).toEqual("Brick 1x2");
});

test("decodeHtml: handles empty string", () => {
  expect(decodeHtml("")).toEqual("");
});

test("decodeHtml: handles mixed references and plain text", () => {
  expect(decodeHtml("Hinge&#44; Plate 1 x 2 &#40;2 fingers&#41;")).toEqual("Hinge, Plate 1 x 2 (2 fingers)");
});
