export interface RevenueStream {
  id: string;
  name: string;
  monthlyRevenue: number;
  growthRate: number; // monthly %
}

export interface CostItem {
  id: string;
  name: string;
  monthlyCost: number;
  isFixed: boolean; // fixed vs variable (% of revenue)
  growthRate: number;
}

export interface Assumptions {
  revenueStreams: RevenueStream[];
  costItems: CostItem[];
  initialCash: number;
  taxRate: number;
  capex: number;
  workingCapitalDays: number;
  forecastMonths: number;
}

export interface MonthProjection {
  month: number;
  label: string;
  totalRevenue: number;
  totalFixedCosts: number;
  totalVariableCosts: number;
  grossProfit: number;
  operatingProfit: number;
  taxes: number;
  netIncome: number;
  capex: number;
  workingCapitalChange: number;
  freeCashFlow: number;
  cumulativeCash: number;
}

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  revenueStreams: [
    { id: "1", name: "Product Sales", monthlyRevenue: 50000, growthRate: 3 },
    { id: "2", name: "Services", monthlyRevenue: 15000, growthRate: 2 },
  ],
  costItems: [
    { id: "1", name: "Rent", monthlyCost: 5000, isFixed: true, growthRate: 0 },
    { id: "2", name: "Salaries", monthlyCost: 20000, isFixed: true, growthRate: 1 },
    { id: "3", name: "COGS", monthlyCost: 30, isFixed: false, growthRate: 0 },
    { id: "4", name: "Marketing", monthlyCost: 3000, isFixed: true, growthRate: 2 },
    { id: "5", name: "Utilities & Other", monthlyCost: 2000, isFixed: true, growthRate: 0.5 },
  ],
  initialCash: 100000,
  taxRate: 25,
  capex: 2000,
  workingCapitalDays: 30,
  forecastMonths: 24,
};

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function projectCashFlows(assumptions: Assumptions): MonthProjection[] {
  const projections: MonthProjection[] = [];
  let cumulativeCash = assumptions.initialCash;
  let prevRevenue = 0;

  for (let m = 0; m < assumptions.forecastMonths; m++) {
    const label = `${monthLabels[m % 12]} Y${Math.floor(m / 12) + 1}`;

    let totalRevenue = 0;
    for (const stream of assumptions.revenueStreams) {
      totalRevenue += stream.monthlyRevenue * Math.pow(1 + stream.growthRate / 100, m);
    }

    let totalFixedCosts = 0;
    let totalVariableCosts = 0;
    for (const cost of assumptions.costItems) {
      if (cost.isFixed) {
        totalFixedCosts += cost.monthlyCost * Math.pow(1 + cost.growthRate / 100, m);
      } else {
        totalVariableCosts += totalRevenue * (cost.monthlyCost / 100);
      }
    }

    const grossProfit = totalRevenue - totalVariableCosts;
    const operatingProfit = grossProfit - totalFixedCosts;
    const taxes = operatingProfit > 0 ? operatingProfit * (assumptions.taxRate / 100) : 0;
    const netIncome = operatingProfit - taxes;
    const capex = assumptions.capex;
    const wcChange = m === 0 
      ? totalRevenue * (assumptions.workingCapitalDays / 365)
      : (totalRevenue - prevRevenue) * (assumptions.workingCapitalDays / 365);
    const freeCashFlow = netIncome - capex - wcChange;
    cumulativeCash += freeCashFlow;

    projections.push({
      month: m + 1,
      label,
      totalRevenue: Math.round(totalRevenue),
      totalFixedCosts: Math.round(totalFixedCosts),
      totalVariableCosts: Math.round(totalVariableCosts),
      grossProfit: Math.round(grossProfit),
      operatingProfit: Math.round(operatingProfit),
      taxes: Math.round(taxes),
      netIncome: Math.round(netIncome),
      capex,
      workingCapitalChange: Math.round(wcChange),
      freeCashFlow: Math.round(freeCashFlow),
      cumulativeCash: Math.round(cumulativeCash),
    });

    prevRevenue = totalRevenue;
  }

  return projections;
}

export function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toLocaleString()}`;
}

export function formatFullCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}
