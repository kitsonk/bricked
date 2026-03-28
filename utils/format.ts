import { humanReadableTimestamp } from "@blaze/human-readable-timestamp";

/**
 * Format a date string or Date object as a human-readable relative time,
 * e.g. "3 hours ago", "2 days ago".
 */
export function humanTime(date: string | Date): string {
  return humanReadableTimestamp(typeof date === "string" ? new Date(date) : date);
}

/**
 * Format a BrickLink monetary amount string (always 4 decimal places) to
 * 2 decimal places for display purposes.
 */
export function formatAmount(amount: string): string {
  return parseFloat(amount).toFixed(2);
}

const ITEM_TYPE_CODE: Record<string, string> = {
  PART: "P",
  MINIFIG: "M",
  SET: "S",
  BOOK: "B",
  GEAR: "G",
  CATALOG: "C",
  INSTRUCTION: "I",
  ORIGINAL_BOX: "O",
  UNSORTED_LOT: "U",
};

export function bricklinkItemImageUrl(itemType: string, itemNo: string, colorId: number): string {
  const prefix = ITEM_TYPE_CODE[itemType] ?? itemType;
  const typeCode = prefix + "N";
  const colorSegment = itemType === "PART" ? colorId : 0;
  return `https://img.bricklink.com/ItemImage/${typeCode}/${colorSegment}/${itemNo}.png`;
}
