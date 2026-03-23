import { assertEquals } from "jsr:@std/assert@1.0.19";
import { decodeHtml } from "@/utils/html.ts";

// ---------------------------------------------------------------------------
// Decimal numeric references
// ---------------------------------------------------------------------------

Deno.test("decodeHtml: decodes decimal numeric references", () => {
  assertEquals(decodeHtml("&#40;"), "(");
  assertEquals(decodeHtml("&#41;"), ")");
  assertEquals(decodeHtml("&#38;"), "&");
});

Deno.test("decodeHtml: decodes multiple decimal references in one string", () => {
  assertEquals(decodeHtml("Plate&#44; Round 1&#47;2&#34;"), 'Plate, Round 1/2"');
});

// ---------------------------------------------------------------------------
// Hex numeric references
// ---------------------------------------------------------------------------

Deno.test("decodeHtml: decodes lowercase hex numeric references", () => {
  assertEquals(decodeHtml("&#x28;"), "(");
  assertEquals(decodeHtml("&#x26;"), "&");
});

Deno.test("decodeHtml: decodes uppercase hex numeric references", () => {
  assertEquals(decodeHtml("&#X28;"), "(");
  assertEquals(decodeHtml("&#X2F;"), "/");
});

// ---------------------------------------------------------------------------
// Named character references
// ---------------------------------------------------------------------------

Deno.test("decodeHtml: decodes &amp;", () => {
  assertEquals(decodeHtml("Brick &amp; Mortar"), "Brick & Mortar");
});

Deno.test("decodeHtml: decodes &lt; and &gt;", () => {
  assertEquals(decodeHtml("&lt;3&gt;"), "<3>");
});

Deno.test("decodeHtml: decodes &quot;", () => {
  assertEquals(decodeHtml("2&quot; Plate"), '2" Plate');
});

Deno.test("decodeHtml: decodes &apos;", () => {
  assertEquals(decodeHtml("it&apos;s"), "it's");
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

Deno.test("decodeHtml: returns plain strings unchanged", () => {
  assertEquals(decodeHtml("Brick 1x2"), "Brick 1x2");
});

Deno.test("decodeHtml: handles empty string", () => {
  assertEquals(decodeHtml(""), "");
});

Deno.test("decodeHtml: handles mixed references and plain text", () => {
  assertEquals(decodeHtml("Hinge&#44; Plate 1 x 2 &#40;2 fingers&#41;"), "Hinge, Plate 1 x 2 (2 fingers)");
});
