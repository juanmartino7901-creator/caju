// =====================================================
// Cajú — Cash Flow Formatting Utilities
// =====================================================

export function formatCurrency(value, compact = false, currencyCode) {
  const prefix = currencyCode || '$';
  if (compact) {
    if (Math.abs(value) >= 1_000_000) {
      return `${prefix} ${(value / 1_000_000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1_000) {
      return `${prefix} ${(value / 1_000).toFixed(1)}K`;
    }
    return `${prefix} ${value.toFixed(0)}`;
  }
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value);
  return `${prefix} ${formatted}`;
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

export function formatPercent(value, decimals = 1) {
  return `${value.toFixed(decimals)}%`;
}

export function formatNegative(value, currencyCode) {
  if (value < 0) return `(${formatCurrency(Math.abs(value), false, currencyCode)})`;
  return formatCurrency(value, false, currencyCode);
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function getMonthLabel(monthIndex) {
  const calMonth = monthIndex % 12;
  const year = Math.floor(monthIndex / 12) + 1;
  return `${MONTH_LABELS[calMonth]} Y${year}`;
}

export function getMonthLabels() {
  return [...MONTH_LABELS];
}
