// ============================================================
// src/lib/itau-format.js
// Generates Itaú Link Empresa compatible payment files
// ============================================================

/**
 * Bank codes for Itaú upload format
 */
export const BANK_CODES = {
  'Itaú': '113',
  'BROU': '  1',
  'Santander': '137',
  'Scotiabank': '128',
  'BBVA': '153',
  'HSBC': '157',
  'Bandes': '110',
  'Citibank': '205',
  'Nación Argentina': '246',
};

/**
 * Month codes for Itaú date format (DDMMMYY)
 */
const MONTH_CODES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
                     'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * Format a date as DDMMMYY (Itaú format)
 * Example: 2026-02-20 → "20FEB26"
 */
function formatItauDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const dd = String(d.getDate()).padStart(2, '0');
  const mmm = MONTH_CODES[d.getMonth()];
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}${mmm}${yy}`;
}

/**
 * Format amount as 15-digit Itaú format (last 2 = decimals)
 * Example: 45200.50 → "000000004520050"
 */
function formatItauAmount(amount) {
  const cents = Math.round(amount * 100);
  return String(cents).padStart(15, '0');
}

/**
 * Pad string to exact length
 */
function padRight(str, len) {
  return (str || '').substring(0, len).padEnd(len, ' ');
}
function padLeft(str, len) {
  return (str || '').substring(0, len).padStart(len, ' ');
}

/**
 * Replace special characters per Itaú rules
 */
function sanitizeItau(str) {
  return (str || '')
    .replace(/[ñÑ]/g, '#')
    .replace(/[áÁ]/g, 'a')
    .replace(/[éÉ]/g, 'e')
    .replace(/[íÍ]/g, 'i')
    .replace(/[óÓ]/g, 'o')
    .replace(/[úÚüÜ]/g, 'u')
    .replace(/[^a-zA-Z0-9 /?()\.,'+\-]/g, ' ');
}

// ============================================================
// CLASSIC FORMAT — Transfers within Itaú (97 positions)
// ============================================================

/**
 * Generate Classic format line for Itaú-to-Itaú transfers
 * @param {Object} payment - Payment details
 * @param {string} payment.debitAccount - 7-digit debit account
 * @param {string} payment.creditAccount - 7-digit credit account
 * @param {string} payment.currency - 'UYU' or 'USD'
 * @param {number} payment.amount - Amount to pay
 * @param {string} payment.date - Payment date YYYY-MM-DD
 * @param {string} payment.reference - Invoice number / reference
 * @param {string} payment.officeCode - 2-digit office code (optional)
 * @param {string} payment.fundDestination - PAP, PHP, PSS, PDA, OTR
 */
export function generateItauClassicLine(payment) {
  const {
    debitAccount,
    creditAccount,
    currency = 'UYU',
    amount,
    date,
    reference = '',
    officeCode = '',
    fundDestination = 'PAP',
  } = payment;

  const currencyCode = currency === 'USD' ? 'US.D' : 'URGP';

  // Build 97-position line
  let line = '';
  line += padLeft(debitAccount, 7);          // 1-7:   Cuenta débito
  line += '7777';                             // 8-11:  Aplicativo (proveedores)
  line += '2';                                // 12:    Tipo pago (acreditación cuenta)
  line += '       ';                          // 13-19: Filler
  line += padRight(sanitizeItau(reference), 12); // 20-31: Referencia
  line += padRight('', 28);                   // 32-59: Filler
  line += padLeft(creditAccount, 7);          // 60-66: Cuenta crédito
  line += currencyCode;                       // 67-70: Moneda
  line += formatItauAmount(amount);           // 71-85: Monto
  line += formatItauDate(date);               // 86-92: Fecha
  line += padRight(officeCode, 2);            // 93-94: Oficina
  line += padRight(fundDestination, 3);       // 95-97: Destino fondos

  return line;
}

// ============================================================
// TRANSFERS TO OTHER BANKS (165 positions)
// ============================================================

/**
 * Generate line for transfers to other banks
 */
export function generateItauInterBankLine(payment) {
  const {
    bankCode,
    accountType = '0', // 0=CC, 1=CA
    creditAccount,
    currency = 'UYU',
    amount,
    beneficiaryName = '',
    beneficiaryNumber = '',
    reference = '',
    fundDestination = 'PAP',
  } = payment;

  const currencyCode = currency === 'USD' ? 'US.D' : 'URGP';

  let line = '';
  line += padLeft(bankCode, 3);              // 1-3:   Código banco
  line += accountType;                        // 4:     Tipo cuenta
  line += ' ';                                // 5:     Filler
  line += padLeft(creditAccount, 21);         // 6-26:  Número cuenta
  line += currencyCode;                       // 27-30: Moneda
  line += padLeft(formatItauAmount(amount).slice(-16), 16); // 31-46: Monto
  line += padRight(sanitizeItau(beneficiaryName), 32);      // 47-78: Nombre
  line += padLeft(beneficiaryNumber, 14);     // 79-92: Número beneficiario
  line += padRight(sanitizeItau(reference), 70); // 93-162: Referencia
  line += padRight(fundDestination, 3);       // 163-165: Destino

  return line;
}

// ============================================================
// BATCH FILE GENERATOR
// ============================================================

/**
 * Generate complete Itaú payment file
 * @param {Array} payments - Array of payment objects with supplier data
 * @param {string} debitAccount - Account to debit from
 * @param {string} officeCode - Office code
 * @returns {Object} { content, filename, summary }
 */
export function generateItauPaymentFile(payments, debitAccount, officeCode = '') {
  const lines = [];
  let totalAmount = 0;
  let itauCount = 0;
  let otherBankCount = 0;

  for (const p of payments) {
    const isItau = p.supplier?.bank_code === '113' || p.supplier?.bank_name === 'Itaú';
    
    if (isItau) {
      // Itaú-to-Itaú: Classic format
      lines.push(generateItauClassicLine({
        debitAccount,
        creditAccount: p.supplier.account_number,
        currency: p.currency || 'UYU',
        amount: p.amount,
        date: p.payment_date,
        reference: p.invoice_number || '',
        officeCode,
        fundDestination: p.fund_destination || 'PAP',
      }));
      itauCount++;
    } else {
      // Other banks: Inter-bank format
      lines.push(generateItauInterBankLine({
        bankCode: p.supplier?.bank_code || '1',
        accountType: p.supplier?.account_type === 'CA' ? '1' : '0',
        creditAccount: p.supplier?.account_number || '',
        currency: p.currency || 'UYU',
        amount: p.amount,
        beneficiaryName: p.supplier?.name || '',
        reference: `${p.invoice_number || ''} ${p.supplier?.alias || ''}`.trim(),
        fundDestination: p.fund_destination || 'PAP',
      }));
      otherBankCount++;
    }

    totalAmount += p.amount;
  }

  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const filename = `pago_proveedores_${today}.txt`;

  return {
    content: lines.join('\n'),
    filename,
    summary: {
      total_payments: payments.length,
      total_amount: totalAmount,
      itau_transfers: itauCount,
      other_bank_transfers: otherBankCount,
    },
  };
}

// ============================================================
// EXCEL EXPORT
// ============================================================

/**
 * Generate payment list data for Excel export
 * (The actual Excel is generated in the API route using exceljs)
 */
export function preparePaymentListData(payments, suppliers) {
  return payments.map((p, i) => {
    const sup = suppliers.find(s => s.id === p.supplier_id) || {};
    return {
      number: i + 1,
      supplier_name: sup.name || p.supplier_name_raw || '—',
      supplier_alias: sup.alias || '',
      tax_id: sup.tax_id || p.supplier_tax_id_raw || '—',
      bank: sup.bank_name || '—',
      bank_code: sup.bank_code || '',
      account_type: sup.account_type || '—',
      account_number: sup.account_number || '—',
      invoice_number: p.invoice_number || '—',
      due_date: p.due_date,
      amount: p.total,
      currency: p.currency || 'UYU',
      status: p.status,
    };
  });
}
