export function formatCurrency(value: number, compact = false, currencyCode?: string): string {
  const symbol = currencyCode || '$';
  const isSymbol = symbol.length > 3 ? false : true; // short codes used as prefix
  const prefix = symbol;
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

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatNegative(value: number, currencyCode?: string): string {
  if (value < 0) return `(${formatCurrency(Math.abs(value), false, currencyCode)})`;
  return formatCurrency(value, false, currencyCode);
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function getMonthLabel(monthIndex: number): string {
  const calMonth = monthIndex % 12;
  const year = Math.floor(monthIndex / 12) + 1;
  return `${MONTH_LABELS[calMonth]} Y${year}`;
}

export function getMonthLabels(): string[] {
  return [...MONTH_LABELS];
}
