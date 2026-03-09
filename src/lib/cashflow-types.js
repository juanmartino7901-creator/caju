// =====================================================
// Cajú — Financial Planning Data Model
// =====================================================

/** @typedef {'local' | 'USD'} CostCurrency */

/**
 * @typedef {Object} PaymentTerms
 * @property {number} pct0 - % paid immediately (0 days)
 * @property {number} pct30 - % paid in 30 days
 * @property {number} pct60 - % paid in 60 days
 */

/**
 * @typedef {Object} ProjectSetup
 * @property {string} name
 * @property {string} currency
 * @property {string} [secondaryCurrency]
 * @property {number} [exchangeRate]
 * @property {number[]} [exchangeRates] - year-end exchange rate per year
 * @property {string} startDate - YYYY-MM
 * @property {number} horizonMonths
 * @property {number} discountRate - annual %
 * @property {number[]} inflationRates - per year, annual %
 */

/**
 * @typedef {Object} Product
 * @property {string} id
 * @property {string} name
 * @property {number} unitPrice
 * @property {number} unitsSoldPerMonth
 * @property {number} grossMarginPct
 * @property {number[]} seasonality - 12 multipliers
 * @property {number[]} annualRealGrowth - per year, %
 * @property {number} startMonth
 * @property {PaymentTerms} [paymentTerms]
 * @property {CostCurrency} [currency]
 */

/**
 * @typedef {Object} RevenueStream
 * @property {string} id
 * @property {string} name
 * @property {number} baseMonthlyRevenue
 * @property {number} grossMarginPct
 * @property {number[]} seasonality - 12 multipliers
 * @property {number[]} annualRealGrowth - per year, %
 * @property {number} startMonth
 * @property {PaymentTerms} [paymentTerms]
 * @property {CostCurrency} [currency]
 * @property {boolean} useProducts
 * @property {Product[]} products
 */

/**
 * @typedef {Object} VariableCost
 * @property {string} id
 * @property {string} name
 * @property {string} [linkedRevenueStreamId]
 * @property {number} percentOfRevenue
 * @property {PaymentTerms} [paymentTerms]
 */

/**
 * @typedef {Object} FixedCost
 * @property {string} id
 * @property {string} name
 * @property {number} monthlyAmount
 * @property {number} startMonth
 * @property {'inflation' | 'manual' | 'flat'} escalation
 * @property {number[]} [manualRates]
 * @property {CostCurrency} [currency]
 */

/**
 * @typedef {Object} Employee
 * @property {string} id
 * @property {string} role
 * @property {number} headcount
 * @property {number} monthlySalary
 * @property {number} startMonth
 * @property {number} socialChargesPct
 * @property {CostCurrency} [currency]
 */

/**
 * @typedef {Object} CapExItem
 * @property {string} id
 * @property {string} name
 * @property {number} amount
 * @property {number} month
 * @property {number} [amortizationMonths]
 * @property {CostCurrency} [currency]
 */

/**
 * @typedef {Object} Loan
 * @property {string} id
 * @property {string} name
 * @property {number} principal
 * @property {number} annualRate
 * @property {number} firstPaymentMonth
 * @property {'monthly' | 'quarterly' | 'annual'} frequency
 * @property {number} installments
 * @property {number} graceMonths
 */

/**
 * @typedef {Object} TaxAssumptions
 * @property {number} incomeTaxRate
 * @property {number} vatRate
 * @property {number} payrollTaxRate
 */

/**
 * @typedef {Object} ProjectData
 * @property {ProjectSetup} setup
 * @property {RevenueStream[]} revenueStreams
 * @property {VariableCost[]} variableCosts
 * @property {FixedCost[]} fixedCosts
 * @property {Employee[]} employees
 * @property {CapExItem[]} capexItems
 * @property {Loan[]} loans
 * @property {number} initialCash
 * @property {TaxAssumptions} taxAssumptions
 */

/**
 * @typedef {Object} RevenueLineItem
 * @property {string} streamId
 * @property {string} name
 * @property {number} amount
 */

/**
 * @typedef {Object} CostLineItem
 * @property {string} id
 * @property {string} name
 * @property {number} amount
 */

/**
 * @typedef {Object} LoanPayment
 * @property {string} loanId
 * @property {string} name
 * @property {number} principal
 * @property {number} interest
 */

/**
 * @typedef {Object} MonthlyProjection
 * @property {number} month
 * @property {string} label
 * @property {number} year
 * @property {number} calendarMonth
 * @property {RevenueLineItem[]} revenueLines
 * @property {number} totalRevenue
 * @property {CostLineItem[]} variableCostLines
 * @property {number} totalVariableCosts
 * @property {number} grossProfit
 * @property {CostLineItem[]} fixedCostLines
 * @property {CostLineItem[]} employeeCostLines
 * @property {number} totalFixedCosts
 * @property {number} ebitda
 * @property {CostLineItem[]} capexLines
 * @property {number} totalCapex
 * @property {LoanPayment[]} loanPayments
 * @property {number} totalLoanPrincipal
 * @property {number} totalLoanInterest
 * @property {number} incomeTax
 * @property {number} netCashFlow
 * @property {number} openingCash
 * @property {number} closingCash
 * @property {number} accountsReceivable
 * @property {number} accountsPayable
 */

/**
 * @typedef {Object} Scenario
 * @property {string} id
 * @property {string} name
 * @property {ProjectData} data
 */

export const DEFAULT_PAYMENT_TERMS = { pct0: 100, pct30: 0, pct60: 0 };
