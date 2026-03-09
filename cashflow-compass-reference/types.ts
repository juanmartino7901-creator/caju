// =====================================================
// Cajú — Financial Planning Data Model
// =====================================================

export interface ProjectSetup {
  name: string;
  currency: string;
  secondaryCurrency?: string;
  exchangeRate?: number; // kept for backward compat, ignored if exchangeRates exists
  exchangeRates?: number[]; // year-end exchange rate per year (local per 1 USD)
  startDate: string; // YYYY-MM
  horizonMonths: number;
  discountRate: number; // annual %
  inflationRates: number[]; // per year, annual %
}

export interface PaymentTerms {
  pct0: number;   // % paid immediately (0 days)
  pct30: number;  // % paid in 30 days
  pct60: number;  // % paid in 60 days
}

export const DEFAULT_PAYMENT_TERMS: PaymentTerms = { pct0: 100, pct30: 0, pct60: 0 };

export interface Product {
  id: string;
  name: string;
  unitPrice: number;
  unitsSoldPerMonth: number;
  grossMarginPct: number; // 0-100
  seasonality: number[]; // 12 multipliers
  annualRealGrowth: number[]; // per year, %
  startMonth: number;
  paymentTerms?: PaymentTerms;
  currency?: CostCurrency; // defaults to 'local'
}

export interface RevenueStream {
  id: string;
  name: string;
  // Simple mode fields
  baseMonthlyRevenue: number;
  grossMarginPct: number; // 0-100
  seasonality: number[]; // 12 multipliers, default 1.0
  annualRealGrowth: number[]; // per year, %
  startMonth: number; // 0-indexed from projection start
  paymentTerms?: PaymentTerms;
  currency?: CostCurrency; // defaults to 'local'
  // Product detail mode
  useProducts: boolean;
  products: Product[];
}

export interface VariableCost {
  id: string;
  name: string;
  linkedRevenueStreamId?: string; // if linked to a revenue stream
  percentOfRevenue: number; // 0-100
  paymentTerms?: PaymentTerms;
}

export type CostCurrency = 'local' | 'USD';

export interface FixedCost {
  id: string;
  name: string;
  monthlyAmount: number;
  startMonth: number;
  escalation: 'inflation' | 'manual' | 'flat';
  manualRates?: number[]; // per year, %
  currency?: CostCurrency; // defaults to 'local'
}

export interface Employee {
  id: string;
  role: string;
  headcount: number;
  monthlySalary: number;
  startMonth: number;
  socialChargesPct: number; // % on top of salary
  currency?: CostCurrency; // defaults to 'local'
}

export interface CapExItem {
  id: string;
  name: string;
  amount: number;
  month: number; // which month (0-indexed)
  amortizationMonths?: number;
  currency?: CostCurrency; // defaults to 'local'
}

export interface Loan {
  id: string;
  name: string;
  principal: number;
  annualRate: number; // %
  firstPaymentMonth: number;
  frequency: 'monthly' | 'quarterly' | 'annual';
  installments: number;
  graceMonths: number;
}

export interface TaxAssumptions {
  incomeTaxRate: number; // %
  vatRate: number; // % informational
  payrollTaxRate: number; // %
}

export interface ProjectData {
  setup: ProjectSetup;
  revenueStreams: RevenueStream[];
  variableCosts: VariableCost[];
  fixedCosts: FixedCost[];
  employees: Employee[];
  capexItems: CapExItem[];
  loans: Loan[];
  initialCash: number;
  taxAssumptions: TaxAssumptions;
}

// =====================================================
// Cash Flow Output Types
// =====================================================

export interface RevenueLineItem {
  streamId: string;
  name: string;
  amount: number;
}

export interface CostLineItem {
  id: string;
  name: string;
  amount: number;
}

export interface LoanPayment {
  loanId: string;
  name: string;
  principal: number;
  interest: number;
}

export interface MonthlyProjection {
  month: number; // 0-indexed
  label: string; // "Jan Y1"
  year: number;
  calendarMonth: number; // 0-11

  // Revenue
  revenueLines: RevenueLineItem[];
  totalRevenue: number;

  // Variable Costs
  variableCostLines: CostLineItem[];
  totalVariableCosts: number;

  // Gross Profit
  grossProfit: number;

  // Fixed Costs
  fixedCostLines: CostLineItem[];
  employeeCostLines: CostLineItem[];
  totalFixedCosts: number;

  // EBITDA
  ebitda: number;

  // CapEx
  capexLines: CostLineItem[];
  totalCapex: number;

  // Loan payments
  loanPayments: LoanPayment[];
  totalLoanPrincipal: number;
  totalLoanInterest: number;

  // Tax
  incomeTax: number;

  // Net Cash Flow
  netCashFlow: number;

  // Balances
  openingCash: number;
  closingCash: number;

  // Working Capital
  accountsReceivable: number;
  accountsPayable: number;
}

export interface Scenario {
  id: string;
  name: string;
  data: ProjectData;
}
