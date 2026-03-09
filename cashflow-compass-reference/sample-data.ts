import type { ProjectData } from './types';

const defaultSeasonality = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
const retailSeasonality = [0.8, 0.7, 0.9, 1.0, 1.0, 1.1, 1.0, 0.9, 1.0, 1.1, 1.3, 1.5]; // holiday spike

const fiveYearGrowth = [5, 8, 10, 7, 5]; // % per year
const moderateGrowth = [3, 4, 5, 4, 3];
const flatGrowth = [0, 0, 0, 0, 0];

export const SAMPLE_PROJECT: ProjectData = {
  setup: {
    name: "Downtown Retail Store",
    currency: "USD",
    startDate: "2025-01",
    horizonMonths: 60,
    discountRate: 12,
    inflationRates: [3, 3.5, 3, 2.5, 2.5],
  },
  revenueStreams: [
    {
      id: "rev-1",
      name: "In-Store Sales",
      baseMonthlyRevenue: 45000,
      grossMarginPct: 55,
      seasonality: retailSeasonality,
      annualRealGrowth: fiveYearGrowth,
      startMonth: 0,
      useProducts: true,
      products: [
        { id: "p-1", name: "Apparel", unitPrice: 45, unitsSoldPerMonth: 400, grossMarginPct: 60, seasonality: retailSeasonality, annualRealGrowth: [6, 8, 10, 7, 5], startMonth: 0, paymentTerms: { pct0: 70, pct30: 20, pct60: 10 } },
        { id: "p-2", name: "Accessories", unitPrice: 25, unitsSoldPerMonth: 300, grossMarginPct: 70, seasonality: retailSeasonality, annualRealGrowth: [8, 10, 12, 8, 5], startMonth: 0, paymentTerms: { pct0: 80, pct30: 15, pct60: 5 } },
        { id: "p-3", name: "Home Goods", unitPrice: 60, unitsSoldPerMonth: 200, grossMarginPct: 50, seasonality: [0.7, 0.6, 0.8, 0.9, 1.0, 1.0, 0.9, 0.8, 1.0, 1.2, 1.5, 1.8], annualRealGrowth: [3, 5, 8, 6, 4], startMonth: 0, paymentTerms: { pct0: 60, pct30: 25, pct60: 15 } },
        { id: "p-4", name: "Gift Items", unitPrice: 20, unitsSoldPerMonth: 250, grossMarginPct: 65, seasonality: [0.5, 0.4, 0.7, 0.8, 1.0, 0.8, 0.6, 0.5, 0.9, 1.3, 1.8, 2.5], annualRealGrowth: [4, 6, 8, 5, 4], startMonth: 0 },
      ],
    },
    {
      id: "rev-2",
      name: "Online Sales",
      baseMonthlyRevenue: 15000,
      grossMarginPct: 65,
      seasonality: [0.9, 0.8, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.1, 1.2, 1.4, 1.6],
      annualRealGrowth: [15, 20, 15, 10, 8],
      startMonth: 0,
      useProducts: false,
      products: [],
    },
    {
      id: "rev-3",
      name: "Workshops & Events",
      baseMonthlyRevenue: 5000,
      grossMarginPct: 80,
      seasonality: [0.5, 0.5, 1.0, 1.2, 1.2, 0.8, 0.5, 0.5, 1.2, 1.3, 1.0, 0.8],
      annualRealGrowth: moderateGrowth,
      startMonth: 3,
      useProducts: false,
      products: [],
    },
  ],
  variableCosts: [
    { id: "vc-1", name: "COGS - In-Store", linkedRevenueStreamId: "rev-1", percentOfRevenue: 45, paymentTerms: { pct0: 50, pct30: 30, pct60: 20 } },
    { id: "vc-2", name: "COGS - Online", linkedRevenueStreamId: "rev-2", percentOfRevenue: 35, paymentTerms: { pct0: 40, pct30: 40, pct60: 20 } },
    { id: "vc-3", name: "COGS - Workshops", linkedRevenueStreamId: "rev-3", percentOfRevenue: 20 },
    { id: "vc-4", name: "Packaging & Shipping", linkedRevenueStreamId: "rev-2", percentOfRevenue: 8 },
    { id: "vc-5", name: "Payment Processing", percentOfRevenue: 2.5 },
  ],
  fixedCosts: [
    { id: "fc-1", name: "Rent", monthlyAmount: 8000, startMonth: 0, escalation: 'manual', manualRates: [0, 5, 3, 3, 3] },
    { id: "fc-2", name: "Utilities", monthlyAmount: 1200, startMonth: 0, escalation: 'inflation' },
    { id: "fc-3", name: "Insurance", monthlyAmount: 800, startMonth: 0, escalation: 'inflation' },
    { id: "fc-4", name: "Marketing & Advertising", monthlyAmount: 3500, startMonth: 0, escalation: 'manual', manualRates: [0, 10, 5, 5, 3] },
    { id: "fc-5", name: "Software & Tools", monthlyAmount: 500, startMonth: 0, escalation: 'flat' },
  ],
  employees: [
    { id: "emp-1", role: "Store Manager", headcount: 1, monthlySalary: 5500, startMonth: 0, socialChargesPct: 25 },
    { id: "emp-2", role: "Sales Associate", headcount: 2, monthlySalary: 3200, startMonth: 0, socialChargesPct: 22 },
  ],
  capexItems: [
    { id: "capex-1", name: "Store Renovation", amount: 35000, month: 0 },
    { id: "capex-2", name: "POS System", amount: 5000, month: 0 },
    { id: "capex-3", name: "Website Redesign", amount: 8000, month: 6 },
    { id: "capex-4", name: "Store Expansion", amount: 25000, month: 24 },
  ],
  loans: [
    {
      id: "loan-1",
      name: "Business Loan",
      principal: 80000,
      annualRate: 8.5,
      firstPaymentMonth: 1,
      frequency: 'monthly',
      installments: 48,
      graceMonths: 3,
    },
  ],
  initialCash: 50000,
  taxAssumptions: {
    incomeTaxRate: 25,
    vatRate: 0,
    payrollTaxRate: 0,
  },
};
