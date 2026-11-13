import { describe, expect, test } from "vitest";
import {
  convertToAnalysis,
  normalizeStoreSlug,
  parseNativePrice,
  quantityUplift,
  suggestPrice,
  type PricingInput,
  type TierStoreInput,
} from "@/utils/pricing.ts";

function store(slug: string, prices: number[], name: string | null = null): TierStoreInput {
  return { slug, name, lots: prices.map((price) => ({ price, qty: 1 })), excludedLots: 0 };
}

function input(overrides: Partial<PricingInput>): PricingInput {
  return {
    ownQty: 1,
    tiers: { premium: [], mid: [], competitive: [] },
    marketFloorPrice: null,
    soldQty6mo: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Worked examples from the request
// ---------------------------------------------------------------------------

describe("suggestPrice — worked examples", () => {
  test("single unit: competitive 15/16/17/18, mid 22, premium 26/29", () => {
    const result = suggestPrice(
      input({
        ownQty: 1,
        tiers: {
          competitive: [store("l", [15]), store("b", [16, 17, 18])],
          mid: [store("p", [22])],
          premium: [store("x", [26]), store("y", [29])],
        },
      }),
    );
    expect(result).not.toBeNull();
    expect(result?.breakdown.blend).toBeCloseTo(20.1, 10);
    expect(result?.breakdown.uplift).toBe(1.6);
    expect(result?.breakdown.highCap).toBe(34.8);
    expect(result?.price).toBe(32.16);
    expect(result?.bandLow).toBe(30.55);
    expect(result?.bandHigh).toBe(36.98);
  });

  test("mid quantity: competitive 7/8/9, mid 10, premium 9/17/20, qty 62", () => {
    const result = suggestPrice(
      input({
        ownQty: 62,
        tiers: {
          competitive: [store("l", [7]), store("b", [8, 9])],
          mid: [store("p", [10])],
          premium: [store("x", [9]), store("y", [17]), store("z", [20])],
        },
      }),
    );
    expect(result?.breakdown.blend).toBeCloseTo(10.275, 10);
    expect(result?.breakdown.uplift).toBe(1);
    expect(result?.breakdown.floorCapApplied).toBe(false);
    expect(result?.price).toBe(10.28);
    expect(result?.bandLow).toBe(9.77);
    expect(result?.bandHigh).toBe(11.82);
  });

  test("saturated quantity: floor rule fires, qty 129, floor 6.00", () => {
    const result = suggestPrice(
      input({
        ownQty: 129,
        tiers: {
          competitive: [store("b", [8])],
          mid: [store("p", [9])],
          premium: [store("x", [27]), store("y", [25])],
        },
        marketFloorPrice: 6,
      }),
    );
    expect(result?.breakdown.blend).toBeCloseTo(11.9, 10);
    expect(result?.breakdown.uplift).toBe(0.9);
    expect(result?.breakdown.floorCapApplied).toBe(true);
    expect(result?.breakdown.floorCap).toBe(6);
    expect(result?.price).toBe(6);
    expect(result?.bandLow).toBe(5.7);
    expect(result?.bandHigh).toBe(6.9);
  });
});

// ---------------------------------------------------------------------------
// Weighting and caps
// ---------------------------------------------------------------------------

describe("suggestPrice — weighting", () => {
  test("renormalizes weights when a tier has no priced stores", () => {
    const result = suggestPrice(
      input({
        ownQty: 100,
        tiers: {
          competitive: [store("c", [10])],
          mid: [],
          premium: [store("p", [20])],
        },
      }),
    );
    expect(result?.breakdown.blend).toBeCloseTo((0.5 * 10 + 0.2 * 20) / 0.7, 10);
  });

  test("renormalizes when only the mid tier is present", () => {
    const result = suggestPrice(
      input({ ownQty: 100, tiers: { competitive: [], mid: [store("m", [14])], premium: [] } }),
    );
    expect(result?.breakdown.blend).toBeCloseTo(14, 10);
    expect(result?.breakdown.uplift).toBe(0.9);
    expect(result?.price).toBe(12.6);
  });

  test("returns null when no tier store has lots", () => {
    expect(suggestPrice(input({ tiers: { competitive: [store("c", [])], mid: [], premium: [] } }))).toBeNull();
  });

  test("ignores stores with no matching lots but keeps the tier in the math", () => {
    const result = suggestPrice(
      input({
        ownQty: 100,
        tiers: { competitive: [store("a", [10]), store("b", [])], mid: [], premium: [] },
      }),
    );
    expect(result?.breakdown.blend).toBe(10);
  });

  test("high cap binds to 1.2x the priciest premium store", () => {
    const result = suggestPrice(
      input({
        ownQty: 1,
        tiers: { competitive: [store("c", [20])], mid: [], premium: [store("p", [10])] },
      }),
    );
    // blend 15, uplift 1.6 -> 24, capped at 12.
    expect(result?.breakdown.highCap).toBe(12);
    expect(result?.price).toBe(12);
  });

  test("high cap falls back to the priciest store when no premium tier exists", () => {
    const result = suggestPrice(
      input({
        ownQty: 1,
        tiers: { competitive: [store("c", [20])], mid: [store("m", [30])], premium: [] },
      }),
    );
    expect(result?.breakdown.highCap).toBe(36);
  });
});

// ---------------------------------------------------------------------------
// Floor rule
// ---------------------------------------------------------------------------

describe("suggestPrice — saturation floor", () => {
  const tiers = {
    competitive: [store("c", [8])],
    mid: [] as TierStoreInput[],
    premium: [store("p", [12])],
  };
  // blend = (0.5*8 + 0.2*12) / 0.7 ≈ 9.142857; 0.75 * blend ≈ 6.857

  test("does not fire at qty 99 without demand, even when the floor is low", () => {
    const result = suggestPrice(input({ ownQty: 99, tiers, marketFloorPrice: 6 }));
    expect(result?.breakdown.floorCapApplied).toBe(false);
  });

  test("fires at qty 100", () => {
    const result = suggestPrice(input({ ownQty: 100, tiers, marketFloorPrice: 6 }));
    expect(result?.breakdown.floorCapApplied).toBe(true);
    expect(result?.price).toBe(6);
  });

  test("qty 50 fires only when six-month sales are below the listed quantity", () => {
    const exhausted = suggestPrice(input({ ownQty: 50, tiers, marketFloorPrice: 6, soldQty6mo: 49 }));
    expect(exhausted?.breakdown.floorCapApplied).toBe(true);
    expect(exhausted?.price).toBe(6);

    const stillSelling = suggestPrice(input({ ownQty: 50, tiers, marketFloorPrice: 6, soldQty6mo: 50 }));
    expect(stillSelling?.breakdown.floorCapApplied).toBe(false);
  });

  test("qty 50 with no sales data does not fire", () => {
    const result = suggestPrice(input({ ownQty: 50, tiers, marketFloorPrice: 6 }));
    expect(result?.breakdown.floorCapApplied).toBe(false);
  });

  test("does not fire when the floor is above 75% of the blend", () => {
    const result = suggestPrice(input({ ownQty: 500, tiers, marketFloorPrice: 7 }));
    expect(result?.breakdown.floorCapApplied).toBe(false);
  });

  test("is inert when no floor price is known", () => {
    const result = suggestPrice(input({ ownQty: 500, tiers, marketFloorPrice: null }));
    expect(result?.breakdown.floorCapApplied).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Quantity uplift
// ---------------------------------------------------------------------------

describe("quantityUplift", () => {
  test("bands", () => {
    expect(quantityUplift(1)).toBe(1.6);
    expect(quantityUplift(2)).toBe(1.6);
    expect(quantityUplift(3)).toBe(1.3);
    expect(quantityUplift(12)).toBe(1.3);
    expect(quantityUplift(13)).toBe(1.15);
    expect(quantityUplift(49)).toBe(1.15);
    expect(quantityUplift(50)).toBe(1);
    expect(quantityUplift(99)).toBe(1);
    expect(quantityUplift(100)).toBe(0.9);
    expect(quantityUplift(199)).toBe(0.9);
    expect(quantityUplift(200)).toBe(0.8);
  });
});

// ---------------------------------------------------------------------------
// Currency handling
// ---------------------------------------------------------------------------

describe("parseNativePrice", () => {
  test("parses the AU and US prefixes", () => {
    expect(parseNativePrice("AU $0.095")).toEqual({ code: "AUD", amount: 0.095 });
    expect(parseNativePrice("US $1.25")).toEqual({ code: "USD", amount: 1.25 });
  });

  test("parses symbol-only prefixes", () => {
    expect(parseNativePrice("£3.40")).toEqual({ code: "GBP", amount: 3.4 });
    expect(parseNativePrice("€2.00")).toEqual({ code: "EUR", amount: 2 });
  });

  test("is case-insensitive", () => {
    expect(parseNativePrice("au $0.5")).toEqual({ code: "AUD", amount: 0.5 });
  });

  test("returns null for unknown or empty prefixes", () => {
    expect(parseNativePrice("R$ 12.00")).toBeNull();
    expect(parseNativePrice("")).toBeNull();
  });
});

describe("convertToAnalysis", () => {
  const settings = { analysisCurrency: "AUD", fxRates: { USD: 0.65, EUR: 1.65 } };

  test("same currency passes through", () => {
    expect(convertToAnalysis(10, "aud", settings)).toBe(10);
  });

  test("applies the configured rate", () => {
    expect(convertToAnalysis(10, "usd", settings)).toBeCloseTo(6.5, 10);
  });

  test("returns null when no rate exists", () => {
    expect(convertToAnalysis(10, "GBP", settings)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Rounding
// ---------------------------------------------------------------------------

describe("suggestPrice — rounding", () => {
  test("rounds to two decimals and keeps a one-cent floor", () => {
    const result = suggestPrice(
      input({ ownQty: 200, tiers: { competitive: [store("c", [0.001])], mid: [], premium: [] } }),
    );
    expect(result?.price).toBe(0.01);
  });
});

// ---------------------------------------------------------------------------
// Store slug normalization
// ---------------------------------------------------------------------------

describe("normalizeStoreSlug", () => {
  test("normalizes URLs, mixed case, trailing slashes and query strings", () => {
    expect(normalizeStoreSlug("https://store.bricklink.com/sydneybrickemp")).toBe("sydneybrickemp");
    expect(normalizeStoreSlug("store.bricklink.com/SydneyBrickEmp/")).toBe("sydneybrickemp");
    expect(normalizeStoreSlug("http://www.store.bricklink.com/Brick546?tab=feedback")).toBe("brick546");
    expect(normalizeStoreSlug("  GoldenBrick  ")).toBe("goldenbrick");
  });

  test("returns an empty string for empty input", () => {
    expect(normalizeStoreSlug("   ")).toBe("");
  });
});
