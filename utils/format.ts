/**
 * Format a BrickLink monetary amount string (always 4 decimal places) to
 * 2 decimal places for display purposes.
 */
export function formatAmount(amount: string): string {
  return parseFloat(amount).toFixed(2);
}
