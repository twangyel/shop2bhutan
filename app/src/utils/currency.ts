// Bhutan-friendly pricing utilities
// Uses "Nu." (Ngultrum) as the display currency
// Shows "Est. Nu." where price is estimated (before quotation)

export function formatPrice(amount: number): string {
  return `Nu. ${amount.toLocaleString()}`;
}

export function formatEstimatedPrice(amount: number): string {
  return `Est. Nu. ${amount.toLocaleString()}`;
}

export function formatShortPrice(amount: number): string {
  if (amount >= 100000) return `Nu. ${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `Nu. ${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}k`;
  return `Nu. ${amount}`;
}

export function formatOriginalPrice(amount: number): string {
  return `Nu. ${amount.toLocaleString()}`;
}

export const PRICE_DISCLAIMER = 'Final price after quotation';
export const ESTIMATED_NOTE = 'Estimated only. Final price after quotation.';
