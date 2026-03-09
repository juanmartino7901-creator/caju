// =====================================================
// Cajú — Cash Flow Projection Engine
// =====================================================

import { DEFAULT_PAYMENT_TERMS } from './cashflow-types';
import { getMonthLabel } from './cashflow-format';

function getYearlyCompoundFactor(rates, upToYear) {
  let factor = 1;
  for (let y = 0; y < upToYear && y < rates.length; y++) {
    factor *= (1 + (rates[y] ?? 0) / 100);
  }
  return factor;
}

function getInflationFactor(inflationRates, upToYear) {
  return getYearlyCompoundFactor(inflationRates, upToYear);
}

function computeLoanSchedule(principal, annualRate, installments, graceMonths, firstPaymentMonth, frequency, horizonMonths) {
  const schedule = [];
  const periodsPerYear = frequency === 'monthly' ? 12 : frequency === 'quarterly' ? 4 : 1;
  const periodRate = annualRate / 100 / periodsPerYear;
  const monthsPerPeriod = 12 / periodsPerYear;

  let remainingPrincipal = principal;
  let currentMonth = firstPaymentMonth;

  // Grace period payments (interest only)
  const gracePayments = Math.floor(graceMonths / monthsPerPeriod);
  for (let g = 0; g < gracePayments && currentMonth < horizonMonths; g++) {
    const interest = remainingPrincipal * periodRate;
    schedule.push({ month: currentMonth, principalPayment: 0, interestPayment: interest });
    currentMonth += monthsPerPeriod;
  }

  // Regular payments (PMT)
  if (installments > 0 && periodRate > 0) {
    const pmt = remainingPrincipal * periodRate * Math.pow(1 + periodRate, installments) /
      (Math.pow(1 + periodRate, installments) - 1);

    for (let i = 0; i < installments && currentMonth < horizonMonths; i++) {
      const interest = remainingPrincipal * periodRate;
      const principalPay = pmt - interest;
      schedule.push({ month: currentMonth, principalPayment: principalPay, interestPayment: interest });
      remainingPrincipal -= principalPay;
      currentMonth += monthsPerPeriod;
    }
  } else if (installments > 0 && periodRate === 0) {
    const principalPay = principal / installments;
    for (let i = 0; i < installments && currentMonth < horizonMonths; i++) {
      schedule.push({ month: currentMonth, principalPayment: principalPay, interestPayment: 0 });
      currentMonth += monthsPerPeriod;
    }
  }

  return schedule;
}

function applyPaymentTerms(accruedByMonth, terms, horizonMonths) {
  const cashByMonth = new Array(horizonMonths).fill(0);
  const pct0 = (terms.pct0 ?? 100) / 100;
  const pct30 = (terms.pct30 ?? 0) / 100;
  const pct60 = (terms.pct60 ?? 0) / 100;
  for (let m = 0; m < horizonMonths; m++) {
    const amt = accruedByMonth[m];
    if (amt === 0) continue;
    cashByMonth[m] += amt * pct0;
    if (m + 1 < horizonMonths) cashByMonth[m + 1] += amt * pct30;
    if (m + 2 < horizonMonths) cashByMonth[m + 2] += amt * pct60;
  }
  return cashByMonth;
}

export function getMonthlyExchangeRate(setup, month) {
  const rates = setup.exchangeRates;
  if (!rates || rates.length === 0) return setup.exchangeRate ?? 1;
  const startRate = setup.exchangeRate ?? rates[0] ?? 1;
  const anchors = [{ month: 0, rate: startRate }];
  for (let y = 0; y < rates.length; y++) {
    anchors.push({ month: (y + 1) * 12 - 1, rate: rates[y] });
  }
  if (month <= 0) return startRate;
  if (month >= anchors[anchors.length - 1].month) return anchors[anchors.length - 1].rate;
  for (let i = 0; i < anchors.length - 1; i++) {
    if (month >= anchors[i].month && month <= anchors[i + 1].month) {
      const span = anchors[i + 1].month - anchors[i].month;
      const t = (month - anchors[i].month) / span;
      return anchors[i].rate + t * (anchors[i + 1].rate - anchors[i].rate);
    }
  }
  return rates[rates.length - 1];
}

export function projectCashFlows(data) {
  const { setup, revenueStreams, variableCosts, fixedCosts, employees, capexItems, loans, initialCash, taxAssumptions } = data;
  const H = setup.horizonMonths;

  // Pre-compute loan schedules
  const loanSchedules = loans.map(loan =>
    computeLoanSchedule(
      loan.principal, loan.annualRate, loan.installments,
      loan.graceMonths, loan.firstPaymentMonth, loan.frequency, H
    )
  );

  // --- PASS 1: Compute accrued (economic) amounts per month ---
  const accruedRevenue = revenueStreams.map(stream => {
    const arr = new Array(H).fill(0);
    for (let m = 0; m < H; m++) {
      const calMonth = m % 12;
      if (stream.useProducts && stream.products.length > 0) {
        let streamTotal = 0;
        for (const product of stream.products) {
          if (m < product.startMonth) continue;
          const activeYears = Math.floor((m - product.startMonth) / 12);
          const inflationFactor = getInflationFactor(setup.inflationRates, activeYears);
          const growthFactor = getYearlyCompoundFactor(product.annualRealGrowth, activeYears);
          const seasonality = product.seasonality[calMonth] ?? 1;
          let amount = product.unitPrice * product.unitsSoldPerMonth * seasonality * inflationFactor * growthFactor;
          if (product.currency === 'USD') amount *= getMonthlyExchangeRate(setup, m);
          streamTotal += amount;
        }
        arr[m] = Math.round(streamTotal);
      } else {
        if (m < stream.startMonth) continue;
        const activeYears = Math.floor((m - stream.startMonth) / 12);
        const inflationFactor = getInflationFactor(setup.inflationRates, activeYears);
        const growthFactor = getYearlyCompoundFactor(stream.annualRealGrowth, activeYears);
        const seasonality = stream.seasonality[calMonth] ?? 1;
        let amount = stream.baseMonthlyRevenue * seasonality * inflationFactor * growthFactor;
        if (stream.currency === 'USD') amount *= getMonthlyExchangeRate(setup, m);
        arr[m] = Math.round(amount);
      }
    }
    return arr;
  });

  // Cash revenue per stream: apply payment terms
  const cashRevenue = revenueStreams.map((stream, si) => {
    if (stream.useProducts && stream.products.length > 0) {
      const productCash = stream.products.map(product => {
        const prodAccrued = new Array(H).fill(0);
        for (let m = 0; m < H; m++) {
          if (m < product.startMonth) continue;
          const calMonth = m % 12;
          const activeYears = Math.floor((m - product.startMonth) / 12);
          const inflationFactor = getInflationFactor(setup.inflationRates, activeYears);
          const growthFactor = getYearlyCompoundFactor(product.annualRealGrowth, activeYears);
          const seasonality = product.seasonality[calMonth] ?? 1;
          let amount = product.unitPrice * product.unitsSoldPerMonth * seasonality * inflationFactor * growthFactor;
          if (product.currency === 'USD') amount *= getMonthlyExchangeRate(setup, m);
          prodAccrued[m] = amount;
        }
        return applyPaymentTerms(prodAccrued, product.paymentTerms ?? DEFAULT_PAYMENT_TERMS, H);
      });
      const total = new Array(H).fill(0);
      for (const pc of productCash) {
        for (let m = 0; m < H; m++) total[m] += pc[m];
      }
      return total.map(v => Math.round(v));
    } else {
      return applyPaymentTerms(accruedRevenue[si], stream.paymentTerms ?? DEFAULT_PAYMENT_TERMS, H).map(v => Math.round(v));
    }
  });

  // Variable costs accrued per VC per month
  const accruedVC = variableCosts.map(vc => {
    const arr = new Array(H).fill(0);
    for (let m = 0; m < H; m++) {
      let baseRevenue = accruedRevenue.reduce((s, r) => s + r[m], 0);
      if (vc.linkedRevenueStreamId) {
        const idx = revenueStreams.findIndex(r => r.id === vc.linkedRevenueStreamId);
        baseRevenue = idx >= 0 ? accruedRevenue[idx][m] : 0;
      }
      arr[m] = Math.round(baseRevenue * (vc.percentOfRevenue / 100));
    }
    return arr;
  });

  // Cash VC: apply payment terms
  const cashVC = variableCosts.map((vc, vi) =>
    applyPaymentTerms(accruedVC[vi], vc.paymentTerms ?? DEFAULT_PAYMENT_TERMS, H).map(v => Math.round(v))
  );

  // --- Compute AR and AP balances ---
  function computeOutstandingBalance(accrued, items, horizonMonths) {
    const balance = new Array(horizonMonths).fill(0);
    for (let si = 0; si < accrued.length; si++) {
      const terms = items[si]?.paymentTerms ?? DEFAULT_PAYMENT_TERMS;
      const pct30 = (terms.pct30 ?? 0) / 100;
      const pct60 = (terms.pct60 ?? 0) / 100;
      for (let m = 0; m < horizonMonths; m++) {
        balance[m] += accrued[si][m] * (pct30 + pct60);
        if (m > 0) balance[m] += accrued[si][m - 1] * pct60;
      }
    }
    return balance.map(v => Math.round(v));
  }

  // AR calculation
  const arByMonth = new Array(H).fill(0);
  for (let si = 0; si < revenueStreams.length; si++) {
    const stream = revenueStreams[si];
    if (stream.useProducts && stream.products.length > 0) {
      for (const product of stream.products) {
        const terms = product.paymentTerms ?? DEFAULT_PAYMENT_TERMS;
        const pct30 = (terms.pct30 ?? 0) / 100;
        const pct60 = (terms.pct60 ?? 0) / 100;
        const prodAccrued = new Array(H).fill(0);
        for (let m = 0; m < H; m++) {
          if (m < product.startMonth) continue;
          const calMonth = m % 12;
          const activeYears = Math.floor((m - product.startMonth) / 12);
          const inflationFactor = getInflationFactor(setup.inflationRates, activeYears);
          const growthFactor = getYearlyCompoundFactor(product.annualRealGrowth, activeYears);
          const seasonality = product.seasonality[calMonth] ?? 1;
          let amount = product.unitPrice * product.unitsSoldPerMonth * seasonality * inflationFactor * growthFactor;
          if (product.currency === 'USD') amount *= getMonthlyExchangeRate(setup, m);
          prodAccrued[m] = amount;
        }
        for (let m = 0; m < H; m++) {
          arByMonth[m] += prodAccrued[m] * (pct30 + pct60);
          if (m > 0) arByMonth[m] += prodAccrued[m - 1] * pct60;
        }
      }
    } else {
      const terms = stream.paymentTerms ?? DEFAULT_PAYMENT_TERMS;
      const pct30 = (terms.pct30 ?? 0) / 100;
      const pct60 = (terms.pct60 ?? 0) / 100;
      for (let m = 0; m < H; m++) {
        arByMonth[m] += accruedRevenue[si][m] * (pct30 + pct60);
        if (m > 0) arByMonth[m] += accruedRevenue[si][m - 1] * pct60;
      }
    }
  }

  // AP from variable costs
  const apByMonth = computeOutstandingBalance(accruedVC, variableCosts, H);

  // --- PASS 2: Build monthly projections using cash amounts ---
  const projections = [];
  let cumulativeCash = initialCash;
  let cumulativeNetIncome = 0;

  for (let m = 0; m < H; m++) {
    const year = Math.floor(m / 12);
    const calMonth = m % 12;
    const label = getMonthLabel(m);
    const openingCash = cumulativeCash;

    // Revenue (cash received)
    const revenueLines = revenueStreams.map((stream, si) => ({
      streamId: stream.id, name: stream.name, amount: cashRevenue[si][m],
    }));
    const totalRevenue = revenueLines.reduce((s, l) => s + l.amount, 0);

    // Variable Costs (cash paid)
    const variableCostLines = variableCosts.map((vc, vi) => ({
      id: vc.id, name: vc.name, amount: cashVC[vi][m],
    }));
    const totalVariableCosts = variableCostLines.reduce((s, l) => s + l.amount, 0);

    const grossProfit = totalRevenue - totalVariableCosts;

    // Fixed Costs
    const fixedCostLines = fixedCosts.map(fc => {
      if (m < fc.startMonth) return { id: fc.id, name: fc.name, amount: 0 };
      const activeYears = Math.floor((m - fc.startMonth) / 12);
      let escalatedAmount = fc.monthlyAmount;
      if (fc.escalation === 'inflation') {
        escalatedAmount *= getInflationFactor(setup.inflationRates, activeYears);
      } else if (fc.escalation === 'manual' && fc.manualRates) {
        escalatedAmount *= getYearlyCompoundFactor(fc.manualRates, activeYears);
      }
      if (fc.currency === 'USD') escalatedAmount *= getMonthlyExchangeRate(setup, m);
      return { id: fc.id, name: fc.name, amount: Math.round(escalatedAmount) };
    });

    // Employees
    const employeeCostLines = employees.map(emp => {
      if (m < emp.startMonth) return { id: emp.id, name: `${emp.role} (x${emp.headcount})`, amount: 0 };
      const activeYears = Math.floor((m - emp.startMonth) / 12);
      const inflationFactor = getInflationFactor(setup.inflationRates, activeYears);
      let totalSalary = emp.headcount * emp.monthlySalary * inflationFactor;
      const socialCharges = totalSalary * (emp.socialChargesPct / 100);
      let amount = totalSalary + socialCharges;
      if (emp.currency === 'USD') amount *= getMonthlyExchangeRate(setup, m);
      return { id: emp.id, name: `${emp.role} (x${emp.headcount})`, amount: Math.round(amount) };
    });

    const totalFixedCosts = fixedCostLines.reduce((s, l) => s + l.amount, 0)
      + employeeCostLines.reduce((s, l) => s + l.amount, 0);

    const ebitda = grossProfit - totalFixedCosts;

    // CapEx
    const capexLines = capexItems
      .filter(ci => ci.month === m)
      .map(ci => {
        const amount = ci.currency === 'USD' ? ci.amount * getMonthlyExchangeRate(setup, m) : ci.amount;
        return { id: ci.id, name: ci.name, amount: Math.round(amount) };
      });
    const totalCapex = capexLines.reduce((s, l) => s + l.amount, 0);

    // Loan Payments
    const loanPayments = loans.map((loan, idx) => {
      const schedule = loanSchedules[idx];
      const payment = schedule.find(p => p.month === m);
      return {
        loanId: loan.id, name: loan.name,
        principal: Math.round(payment?.principalPayment ?? 0),
        interest: Math.round(payment?.interestPayment ?? 0),
      };
    }).filter(lp => lp.principal > 0 || lp.interest > 0);
    const totalLoanPrincipal = loanPayments.reduce((s, l) => s + l.principal, 0);
    const totalLoanInterest = loanPayments.reduce((s, l) => s + l.interest, 0);

    // Income Tax
    const preTexIncome = ebitda - totalLoanInterest;
    cumulativeNetIncome += preTexIncome;
    let incomeTax = 0;
    if (cumulativeNetIncome > 0 && taxAssumptions.incomeTaxRate > 0) {
      incomeTax = Math.max(0, Math.round(preTexIncome * (taxAssumptions.incomeTaxRate / 100)));
    }

    // Net Cash Flow
    const netCashFlow = ebitda - totalCapex - totalLoanPrincipal - totalLoanInterest - incomeTax;
    cumulativeCash += netCashFlow;

    projections.push({
      month: m, label, year, calendarMonth: calMonth,
      revenueLines, totalRevenue, variableCostLines, totalVariableCosts,
      grossProfit, fixedCostLines, employeeCostLines, totalFixedCosts,
      ebitda, capexLines, totalCapex, loanPayments, totalLoanPrincipal,
      totalLoanInterest, incomeTax, netCashFlow, openingCash,
      closingCash: Math.round(cumulativeCash),
      accountsReceivable: Math.round(arByMonth[m]),
      accountsPayable: Math.round(apByMonth[m]),
    });
  }

  return projections;
}

// --- KPI Helpers ---

export function computeNPV(projections, annualDiscountRate) {
  const monthlyRate = annualDiscountRate / 100 / 12;
  return projections.reduce((npv, p) => {
    return npv + p.netCashFlow / Math.pow(1 + monthlyRate, p.month + 1);
  }, 0);
}

export function findBreakEvenMonth(projections) {
  for (const p of projections) {
    if (p.closingCash > 0 && p.month > 0) return p.month + 1;
  }
  return null;
}

export function findPeakDeficit(projections) {
  return Math.min(...projections.map(p => p.closingCash));
}

export function computePaybackPeriod(projections, initialInvestment) {
  let cumulative = -initialInvestment;
  for (const p of projections) {
    cumulative += p.netCashFlow;
    if (cumulative >= 0) return p.month + 1;
  }
  return null;
}

export function getAnnualSummary(projections) {
  const years = new Map();
  for (const p of projections) {
    if (!years.has(p.year)) {
      years.set(p.year, { ...p, label: `Year ${p.year + 1}` });
    } else {
      const existing = years.get(p.year);
      existing.totalRevenue += p.totalRevenue;
      existing.totalVariableCosts += p.totalVariableCosts;
      existing.grossProfit += p.grossProfit;
      existing.totalFixedCosts += p.totalFixedCosts;
      existing.ebitda += p.ebitda;
      existing.totalCapex += p.totalCapex;
      existing.totalLoanPrincipal += p.totalLoanPrincipal;
      existing.totalLoanInterest += p.totalLoanInterest;
      existing.incomeTax += p.incomeTax;
      existing.netCashFlow += p.netCashFlow;
      existing.closingCash = p.closingCash;
      existing.accountsReceivable = p.accountsReceivable;
      existing.accountsPayable = p.accountsPayable;
    }
  }
  return Array.from(years.values());
}
