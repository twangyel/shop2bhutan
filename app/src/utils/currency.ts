// Bhutan-friendly pricing utilities
// Uses "Nu." (Ngultrum) as the display currency
// Shows "Est. Nu." where price is estimated (before quotation)

function cleanAmount(amount: number): number {
  return Number.isFinite(amount) ? Math.round(amount) : 0;
}

export function formatPrice(amount: number): string {
  return `Nu. ${cleanAmount(amount).toLocaleString("en-US")}`;
}

export function formatEstimatedPrice(amount: number): string {
  return `Est. Nu. ${cleanAmount(amount).toLocaleString("en-US")}`;
}

export function formatShortPrice(amount: number): string {
  // Do not abbreviate Bhutan admin/customer prices as k/L.
  // Full values are clearer for quotations, payments, and screenshots.
  return formatPrice(amount);
}

export function formatOriginalPrice(amount: number): string {
  return formatPrice(amount);
}

export const PRICE_DISCLAIMER = 'Final price after quotation';
export const ESTIMATED_NOTE = 'Estimated only. Final price after quotation.';
