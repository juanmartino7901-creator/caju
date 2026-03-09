// =====================================================
// Cajú — Internationalization (EN / ES)
// =====================================================

const translations = {
  // Navigation
  'nav.setup': { en: 'Setup', es: 'Configuración' },
  'nav.revenue': { en: 'Revenue', es: 'Ingresos' },
  'nav.costs': { en: 'Costs', es: 'Costos' },
  'nav.financing': { en: 'Financing', es: 'Financiamiento' },
  'nav.cashflow': { en: 'Cash Flow', es: 'Flujo de Caja' },
  'nav.sensitivity': { en: 'Sensitivity', es: 'Sensibilidad' },
  'app.subtitle': { en: 'Financial Planner', es: 'Planificador Financiero' },

  // Setup page
  'setup.title': { en: 'Project Setup', es: 'Configuración del Proyecto' },
  'setup.subtitle': { en: 'Configure the basic parameters of your financial model.', es: 'Configura los parámetros básicos de tu modelo financiero.' },
  'setup.general': { en: 'General', es: 'General' },
  'setup.projectName': { en: 'Project Name', es: 'Nombre del Proyecto' },
  'setup.currency': { en: 'Currency', es: 'Moneda' },
  'setup.projectionStart': { en: 'Projection Start', es: 'Inicio de Proyección' },
  'setup.horizon': { en: 'Horizon (months)', es: 'Horizonte (meses)' },
  'setup.secondaryCurrency': { en: 'Secondary Currency', es: 'Moneda Secundaria' },
  'setup.exchangeRate': { en: 'Exchange Rate', es: 'Tipo de Cambio' },
  'setup.exchangeRateByYear': { en: 'Exchange Rate by Year-End', es: 'Tipo de Cambio por Fin de Año' },
  'setup.economicAssumptions': { en: 'Economic Assumptions', es: 'Supuestos Económicos' },
  'setup.economicDesc': { en: 'Discount rate and annual inflation rates for each projected year.', es: 'Tasa de descuento y tasas de inflación anual para cada año proyectado.' },
  'setup.discountRate': { en: 'Discount Rate (% annual)', es: 'Tasa de Descuento (% anual)' },
  'setup.inflationByYear': { en: 'Inflation Rates by Year (%)', es: 'Tasas de Inflación por Año (%)' },
  'setup.initialCash': { en: 'Initial Cash Balance', es: 'Saldo Inicial de Caja' },
  'setup.cashOnHand': { en: 'Cash on Hand at Month 0 ($)', es: 'Efectivo Disponible en Mes 0 ($)' },
  'setup.optional': { en: 'Optional', es: 'Opcional' },

  // Revenue page
  'revenue.title': { en: 'Revenue Streams', es: 'Fuentes de Ingreso' },
  'revenue.subtitle': { en: 'Define your income sources with growth and seasonality.', es: 'Define tus fuentes de ingreso con crecimiento y estacionalidad.' },
  'revenue.addStream': { en: 'Add Stream', es: 'Agregar Fuente' },
  'revenue.productDetail': { en: 'Product-Level Detail', es: 'Detalle por Producto' },
  'revenue.productDetailOn': { en: 'Revenue is computed from individual products', es: 'Los ingresos se calculan desde productos individuales' },
  'revenue.productDetailOff': { en: 'Using aggregated revenue (simpler)', es: 'Usando ingresos agregados (más simple)' },
  'revenue.streamName': { en: 'Stream Name', es: 'Nombre de Fuente' },
  'revenue.products': { en: 'Products', es: 'Productos' },
  'revenue.addProduct': { en: 'Add Product', es: 'Agregar Producto' },
  'revenue.noProducts': { en: 'No products yet. Add products to compute revenue from individual items.', es: 'Sin productos aún. Agrega productos para calcular ingresos individuales.' },
  'revenue.totalBaseMonthly': { en: 'Total base monthly revenue:', es: 'Ingreso mensual base total:' },
  'revenue.noStreams': { en: 'No revenue streams yet. Click "Add Stream" to get started.', es: 'Sin fuentes de ingreso aún. Haz clic en "Agregar Fuente" para comenzar.' },

  // Shared field labels
  'field.name': { en: 'Name', es: 'Nombre' },
  'field.baseMonthly': { en: 'Base Monthly ($)', es: 'Base Mensual ($)' },
  'field.grossMargin': { en: 'Gross Margin (%)', es: 'Margen Bruto (%)' },
  'field.startMonth': { en: 'Start Month', es: 'Mes Inicio' },
  'field.unitPrice': { en: 'Unit Price ($)', es: 'Precio Unitario ($)' },
  'field.unitsMonth': { en: 'Units/Month', es: 'Uds/Mes' },
  'field.margin': { en: 'Margin (%)', es: 'Margen (%)' },
  'field.startMo': { en: 'Start Mo.', es: 'Mes In.' },
  'field.seasonality': { en: 'Seasonality Multipliers (1.0 = average)', es: 'Multiplicadores de Estacionalidad (1.0 = promedio)' },
  'field.growthRates': { en: 'Annual Real Growth Rates (%)', es: 'Tasas de Crecimiento Real Anual (%)' },
  'field.paymentTerms': { en: 'Payment Terms (% received)', es: 'Condiciones de Pago (% recibido)' },
  'field.paymentTermsPaid': { en: 'Payment Terms (% paid)', es: 'Condiciones de Pago (% pagado)' },
  'field.days0': { en: '0 days (%)', es: '0 días (%)' },
  'field.days30': { en: '30 days (%)', es: '30 días (%)' },
  'field.days60': { en: '60 days (%)', es: '60 días (%)' },
  'field.mustTotal100': { en: 'Must total 100%', es: 'Debe sumar 100%' },
  'field.currently': { en: 'currently', es: 'actualmente' },
  'field.year': { en: 'Year', es: 'Año' },
  'field.currency': { en: 'Currency', es: 'Moneda' },

  // Costs page
  'costs.title': { en: 'Costs & Investments', es: 'Costos e Inversiones' },
  'costs.subtitle': { en: 'Define your variable costs, fixed costs, employees, and capital expenditures.', es: 'Define tus costos variables, fijos, empleados e inversiones de capital.' },
  'costs.variableCosts': { en: 'Variable Costs', es: 'Costos Variables' },
  'costs.fixedCosts': { en: 'Fixed Costs', es: 'Costos Fijos' },
  'costs.employees': { en: 'Employees', es: 'Empleados' },
  'costs.investments': { en: 'Investments', es: 'Inversiones' },
  'costs.add': { en: 'Add', es: 'Agregar' },
  'costs.pctOfRevenue': { en: '% of Revenue', es: '% de Ingresos' },
  'costs.linkedRevenue': { en: 'Linked Revenue', es: 'Ingreso Vinculado' },
  'costs.allRevenue': { en: 'All Revenue', es: 'Todos los Ingresos' },
  'costs.monthly': { en: 'Monthly ($)', es: 'Mensual ($)' },
  'costs.escalation': { en: 'Escalation', es: 'Escalamiento' },
  'costs.inflation': { en: 'Inflation', es: 'Inflación' },
  'costs.manual': { en: 'Manual', es: 'Manual' },
  'costs.flat': { en: 'Flat', es: 'Plano' },
  'costs.role': { en: 'Role', es: 'Cargo' },
  'costs.headcount': { en: 'Headcount', es: 'Cantidad' },
  'costs.salary': { en: 'Salary ($)', es: 'Salario ($)' },
  'costs.social': { en: 'Social (%)', es: 'Cargas (%)' },
  'costs.amount': { en: 'Amount ($)', es: 'Monto ($)' },
  'costs.monthNum': { en: 'Month #', es: 'Mes #' },
  'costs.amortization': { en: 'Amort. (mo)', es: 'Amort. (meses)' },
  'costs.currency': { en: 'Currency', es: 'Moneda' },
  'costs.localCurrency': { en: 'Local', es: 'Local' },
  'costs.usdCurrency': { en: 'USD', es: 'USD' },

  // Financing page
  'financing.title': { en: 'Financing & Tax', es: 'Financiamiento e Impuestos' },
  'financing.subtitle': { en: 'Manage loans and tax assumptions.', es: 'Administra préstamos y supuestos fiscales.' },
  'financing.taxAssumptions': { en: 'Tax Assumptions', es: 'Supuestos Fiscales' },
  'financing.incomeTax': { en: 'Income Tax (%)', es: 'Imp. Renta (%)' },
  'financing.vat': { en: 'VAT (%)', es: 'IVA (%)' },
  'financing.vatInfo': { en: 'info only', es: 'solo informativo' },
  'financing.payrollTax': { en: 'Payroll Tax (%)', es: 'Imp. Nómina (%)' },
  'financing.loans': { en: 'Loans', es: 'Préstamos' },
  'financing.addLoan': { en: 'Add Loan', es: 'Agregar Préstamo' },
  'financing.principal': { en: 'Principal ($)', es: 'Capital ($)' },
  'financing.annualRate': { en: 'Annual Rate (%)', es: 'Tasa Anual (%)' },
  'financing.firstPmtMonth': { en: 'First Pmt Month', es: 'Mes 1er Pago' },
  'financing.frequency': { en: 'Frequency', es: 'Frecuencia' },
  'financing.monthly': { en: 'Monthly', es: 'Mensual' },
  'financing.quarterly': { en: 'Quarterly', es: 'Trimestral' },
  'financing.annual': { en: 'Annual', es: 'Anual' },
  'financing.installments': { en: '# Installments', es: '# Cuotas' },
  'financing.grace': { en: 'Grace (months)', es: 'Gracia (meses)' },
  'financing.noLoans': { en: 'No loans configured. Click "Add Loan" to add financing.', es: 'Sin préstamos configurados. Haz clic en "Agregar Préstamo" para añadir financiamiento.' },

  // Cash Flow page
  'cf.title': { en: 'Cash Flow Statement', es: 'Estado de Flujo de Caja' },
  'cf.projection': { en: '-month projection', es: ' meses de proyección' },
  'cf.monthly': { en: 'Monthly', es: 'Mensual' },
  'cf.annual': { en: 'Annual', es: 'Anual' },
  'cf.totalRevenue': { en: 'Total Revenue', es: 'Ingresos Totales' },
  'cf.finalCash': { en: 'Final Cash', es: 'Caja Final' },
  'cf.npv': { en: 'NPV', es: 'VPN' },
  'cf.peakDeficit': { en: 'Peak Deficit', es: 'Déficit Máximo' },
  'cf.breakEven': { en: 'Break-Even', es: 'Punto de Equilibrio' },
  'cf.month': { en: 'Month', es: 'Mes' },
  'cf.netCashFlow': { en: 'Net Cash Flow', es: 'Flujo Neto de Caja' },
  'cf.cumulativeCash': { en: 'Cumulative Cash Balance', es: 'Saldo Acumulado de Caja' },
  'cf.revenueVsCosts': { en: 'Revenue vs. Total Costs', es: 'Ingresos vs. Costos Totales' },
  'cf.ebitdaMargin': { en: 'EBITDA Margin (%)', es: 'Margen EBITDA (%)' },
  'cf.workingCapital': { en: 'Working Capital', es: 'Capital de Trabajo' },
  'cf.accountsReceivable': { en: 'Accounts Receivable', es: 'Cuentas por Cobrar' },
  'cf.accountsPayable': { en: 'Accounts Payable', es: 'Cuentas por Pagar' },
  'cf.netWorkingCapital': { en: 'Net Working Capital', es: 'Capital de Trabajo Neto' },
  'cf.detailedStatement': { en: 'Detailed Cash Flow Statement', es: 'Estado Detallado de Flujo de Caja' },
  'cf.expandAll': { en: 'Expand all', es: 'Expandir todo' },
  'cf.collapseAll': { en: 'Collapse all', es: 'Colapsar todo' },
  'cf.lineItem': { en: 'Line Item', es: 'Concepto' },
  'cf.openingCash': { en: 'Opening Cash', es: 'Caja Inicial' },
  'cf.totalCosts': { en: 'Total Costs', es: 'Costos Totales' },
  'cf.grossProfit': { en: 'Gross Profit', es: 'Utilidad Bruta' },
  'cf.totalVariableCosts': { en: 'Total Variable Costs', es: 'Total Costos Variables' },
  'cf.totalFixedCosts': { en: 'Total Fixed Costs', es: 'Total Costos Fijos' },
  'cf.capex': { en: 'CapEx', es: 'CapEx' },
  'cf.loanPrincipal': { en: 'Loan Principal', es: 'Capital Préstamo' },
  'cf.loanInterest': { en: 'Loan Interest', es: 'Interés Préstamo' },
  'cf.incomeTax': { en: 'Income Tax', es: 'Imp. Renta' },
  'cf.closingCash': { en: 'Closing Cash', es: 'Caja Final' },
  'cf.cashBalance': { en: 'Cash Balance', es: 'Saldo de Caja' },
  'cf.revenue': { en: 'Revenue', es: 'Ingresos' },

  // Sensitivity page
  'sens.title': { en: 'Sensitivity Analysis', es: 'Análisis de Sensibilidad' },
  'sens.subtitle': { en: 'Stress-test key assumptions and see their impact on NPV and break-even.', es: 'Prueba de estrés en supuestos clave y su impacto en VPN y punto de equilibrio.' },
  'sens.configuration': { en: 'Configuration', es: 'Configuración' },
  'sens.variableToTest': { en: 'Variable to Test', es: 'Variable a Probar' },
  'sens.steps': { en: 'Steps (comma-separated)', es: 'Pasos (separados por coma)' },
  'sens.npvImpact': { en: 'NPV Impact', es: 'Impacto en VPN' },
  'sens.baseNpv': { en: 'Base NPV', es: 'VPN Base' },
  'sens.monthlyNCF': { en: 'Monthly Net Cash Flow by Scenario', es: 'Flujo Neto Mensual por Escenario' },
  'sens.monthlyNCFDesc': { en: 'How monthly cash flow changes across each sensitivity step', es: 'Cómo cambia el flujo de caja mensual en cada paso de sensibilidad' },
  'sens.scenario': { en: 'Scenario', es: 'Escenario' },
  'sens.allRevenueGrowth': { en: 'All Revenue Growth', es: 'Crecimiento Todos los Ingresos' },
  'sens.inflation': { en: 'Inflation', es: 'Inflación' },
  'sens.incomeTaxRate': { en: 'Income Tax Rate', es: 'Tasa Imp. Renta' },
  'sens.baseRevenue': { en: 'Base Revenue', es: 'Ingreso Base' },
  'sens.fixedCost': { en: 'Fixed Cost', es: 'Costo Fijo' },

  // Auth
  'auth.signIn': { en: 'Sign In', es: 'Iniciar Sesión' },
  'auth.signUp': { en: 'Sign Up', es: 'Registrarse' },
  'auth.email': { en: 'Email', es: 'Correo Electrónico' },
  'auth.password': { en: 'Password', es: 'Contraseña' },
  'auth.displayName': { en: 'Display Name', es: 'Nombre' },
  'auth.hasAccount': { en: 'Already have an account? Sign in', es: '¿Ya tienes cuenta? Inicia sesión' },
  'auth.noAccount': { en: "Don't have an account? Sign up", es: '¿No tienes cuenta? Regístrate' },
  'auth.checkEmail': { en: 'Check your email for confirmation', es: 'Revisa tu correo para confirmar' },
  'auth.signOut': { en: 'Sign Out', es: 'Cerrar Sesión' },

  // Dashboard
  'dash.myProjects': { en: 'My Projects', es: 'Mis Proyectos' },
  'dash.newProject': { en: 'New Project', es: 'Nuevo Proyecto' },
  'dash.noProjects': { en: 'No projects yet. Create your first financial model!', es: '¡Sin proyectos aún. Crea tu primer modelo financiero!' },
  'dash.createFirst': { en: 'Create First Project', es: 'Crear Primer Proyecto' },
  'dash.updated': { en: 'Updated', es: 'Actualizado' },

  // Export
  'cf.export': { en: 'Export CSV', es: 'Exportar CSV' },

  // Month labels
  'month.jan': { en: 'Jan', es: 'Ene' },
  'month.feb': { en: 'Feb', es: 'Feb' },
  'month.mar': { en: 'Mar', es: 'Mar' },
  'month.apr': { en: 'Apr', es: 'Abr' },
  'month.may': { en: 'May', es: 'May' },
  'month.jun': { en: 'Jun', es: 'Jun' },
  'month.jul': { en: 'Jul', es: 'Jul' },
  'month.aug': { en: 'Aug', es: 'Ago' },
  'month.sep': { en: 'Sep', es: 'Sep' },
  'month.oct': { en: 'Oct', es: 'Oct' },
  'month.nov': { en: 'Nov', es: 'Nov' },
  'month.dec': { en: 'Dec', es: 'Dic' },
};

const MONTH_KEYS = [
  'month.jan', 'month.feb', 'month.mar', 'month.apr', 'month.may', 'month.jun',
  'month.jul', 'month.aug', 'month.sep', 'month.oct', 'month.nov', 'month.dec',
];

export function t(key, lang) {
  return translations[key]?.[lang] ?? translations[key]?.['en'] ?? key;
}

export function getMonthLabelI18n(monthIndex, lang) {
  const calMonth = monthIndex % 12;
  const year = Math.floor(monthIndex / 12) + 1;
  return `${t(MONTH_KEYS[calMonth], lang)} A${year}`;
}

export function getMonthLabelsI18n(lang) {
  return MONTH_KEYS.map(k => t(k, lang));
}
