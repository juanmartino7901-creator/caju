import type { MonthlyProjection } from './types';
import { getMonthLabelI18n, type Lang } from './i18n';

export function exportCashFlowCSV(projections: MonthlyProjection[], lang: Lang) {
  const rows: string[][] = [];

  // Header
  const header = ['Line Item', ...projections.map(p => getMonthLabelI18n(p.month, lang))];
  rows.push(header);

  const addRow = (label: string, getValue: (p: MonthlyProjection) => number) => {
    rows.push([label, ...projections.map(p => getValue(p).toFixed(2))]);
  };

  addRow('Opening Cash', p => p.openingCash);
  addRow('Total Revenue', p => p.totalRevenue);
  addRow('Total Variable Costs', p => -p.totalVariableCosts);
  addRow('Gross Profit', p => p.grossProfit);
  addRow('Total Fixed Costs', p => -p.totalFixedCosts);
  addRow('EBITDA', p => p.ebitda);
  addRow('CapEx', p => -p.totalCapex);
  addRow('Loan Principal', p => -p.totalLoanPrincipal);
  addRow('Loan Interest', p => -p.totalLoanInterest);
  addRow('Income Tax', p => -p.incomeTax);
  addRow('Net Cash Flow', p => p.netCashFlow);
  addRow('Closing Cash', p => p.closingCash);
  addRow('Accounts Receivable', p => p.accountsReceivable);
  addRow('Accounts Payable', p => p.accountsPayable);

  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cashflow-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
