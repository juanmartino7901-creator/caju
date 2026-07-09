// ============================================================
// src/lib/extract.js
// AI Invoice Extraction using Claude Vision API + Tool Use
// Unified module for both upload and re-extract endpoints
// ============================================================

import Anthropic from "@anthropic-ai/sdk";

// Lazy-initialized client (avoid module-level crashes on serverless)
let anthropic = null;
function getAnthropic() {
  if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropic;
}

// ─── JSON schema for structured outputs ───────────────────────
// Nullable donde el modelo puede omitir. Strict: additionalProperties:false + required completo.
const N = (t) => ({ type: [t, "null"] });
const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    doc_type: { type: "string", enum: ["invoice", "payroll"] },
    emisor_nombre: N("string"),
    emisor_rut: N("string"),
    comprador_nombre: N("string"),
    comprador_rut: N("string"),
    invoice_number: N("string"),
    invoice_series: N("string"),
    issue_date: N("string"),
    due_date: N("string"),
    currency: { type: "string", enum: ["UYU", "USD"] },
    subtotal: N("number"),
    tax_amount: N("number"),
    total: { type: "number" },
    cae: N("string"),
    payment_terms: N("string"),
    line_items: {
      type: ["array", "null"],
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          description: { type: "string" },
          quantity: N("number"),
          unit_price: N("number"),
          amount: { type: "number" },
        },
        required: ["description", "quantity", "unit_price", "amount"],
      },
    },
    confidence: {
      type: "object",
      additionalProperties: false,
      properties: {
        emisor_nombre: { type: "number" },
        emisor_rut: { type: "number" },
        invoice_number: { type: "number" },
        issue_date: { type: "number" },
        due_date: { type: "number" },
        total: { type: "number" },
        tax_amount: { type: "number" },
        currency: { type: "number" },
      },
      required: ["emisor_nombre", "emisor_rut", "invoice_number", "issue_date", "due_date", "total", "tax_amount", "currency"],
    },
  },
  required: ["doc_type", "emisor_nombre", "emisor_rut", "comprador_nombre", "comprador_rut", "invoice_number", "invoice_series", "issue_date", "due_date", "currency", "subtotal", "tax_amount", "total", "cae", "payment_terms", "line_items", "confidence"],
};

// ─── System prompt ────────────────────────────────────────────
const SYSTEM_PROMPT = `Sos un extractor de datos de documentos financieros uruguayos. Podés recibir DOS tipos de documento:

1. FACTURAS (e-factura, CFE, ticket) — el caso más común
2. LIQUIDACIONES DE SUELDO (recibos de haberes) — reconocibles por campos como "Haberes", "Descuentos", "Líquido a Cobrar", "BPS", "IRPF", "Sueldo Básico", "Aportes Jubilatorios", "Fonasa", "FRL"

Analizá la imagen/documento con MUCHO cuidado, prestando especial atención a la LETRA CHICA (RUT de 12 dígitos, número de factura, y montos), determiná qué tipo es, y devolvé los datos estructurados.

=== REGLAS PARA RECIBOS DE SUELDO ===
- emisor_nombre = nombre de la EMPRESA (ej: "Renenutet SAS"), NO del empleado
- invoice_number = "LIQ-MES-AÑO-CI" usando la CI del empleado sin puntos ni guiones (ej: "LIQ-FEB-2026-5045804"). MES en español 3 letras mayúsculas: ENE, FEB, MAR, ABR, MAY, JUN, JUL, AGO, SET, OCT, NOV, DIC
- total = "Líquido a Cobrar" o "Neto a cobrar" — es lo que se deposita al empleado
- subtotal = Total de Haberes (sueldo bruto antes de descuentos)
- tax_amount = Total de Descuentos (BPS jubilatorio + IRPF + Fonasa + FRL + otros). Siempre positivo
- line_items: incluir cada concepto de haberes como item positivo y cada descuento como item con amount NEGATIVO
- issue_date = último día del mes del período. Si dice "Febrero 2026" → 2026-02-28

=== REGLAS PARA FACTURAS ===
- Los montos SIEMPRE como números JSON con punto decimal. Convertí formato uruguayo (punto=miles, coma=decimal): "3.235,01" → 3235.01, "1.500" → 1500, "450,50" → 450.50
- Si no hay un total explícito, sumá los line_items
- Si hay subtotal e IVA pero no total, calculá total = subtotal + tax_amount
- Si solo hay un monto total, estimá subtotal e IVA (22% en Uruguay)
- Si dice CONTADO y no hay fecha de vencimiento, due_date = issue_date

=== REGLAS GENERALES ===
- Los montos SIEMPRE como números JSON (no strings). "3.235,01" → 3235.01
- Si un campo no es legible, omitilo del resultado y poné confidence 0.0
- El RUT uruguayo tiene 12 dígitos
- NUNCA devuelvas 0 para total si hay montos visibles en el documento
- Las fechas siempre en formato YYYY-MM-DD`;

// ─── Main extraction function ─────────────────────────────────
/**
 * Extract invoice data from a file buffer using Claude Vision + Tool Use
 * @param {Buffer} buffer - File content
 * @param {string} mimeType - MIME type (application/pdf, image/jpeg, image/png, image/webp)
 * @returns {Object} { success, data, warnings }
 */
export async function extractInvoiceData(buffer, mimeType) {
  const base64 = buffer.toString("base64");

  // Build content block
  const content = [];
  if (mimeType === "application/pdf") {
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } });
  } else {
    const mediaType = mimeType === "image/png" ? "image/png" : mimeType === "image/webp" ? "image/webp" : "image/jpeg";
    content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: base64 } });
  }
  content.push({ type: "text", text: "Extraé los datos de este documento financiero uruguayo." });

  // Call Claude (Opus 4.8, high-res vision, structured outputs + adaptive thinking).
  // Retry once on API error.
  let response;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await getAnthropic().messages.create({
        model: "claude-opus-4-8",
        max_tokens: 8192,
        thinking: { type: "adaptive" },
        output_config: { effort: "high", format: { type: "json_schema", schema: EXTRACT_SCHEMA } },
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
      });
      break; // success
    } catch (err) {
      console.error(`Extraction attempt ${attempt + 1} failed:`, err.message);
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 2000)); // wait 2s before retry
      } else {
        return { success: false, data: null, warnings: [`AI extraction failed after 2 attempts: ${err.message}`] };
      }
    }
  }

  // Safety classifiers can decline (rare for invoices)
  if (response.stop_reason === "refusal") {
    return { success: false, data: null, warnings: ["AI rechazó el documento (clasificador de seguridad)"] };
  }

  // With structured outputs, the text block is schema-valid JSON.
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock?.text) {
    return { success: false, data: null, warnings: ["AI did not return structured data"] };
  }
  let parsed;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch (e) {
    return { success: false, data: null, warnings: [`Respuesta no es JSON válido: ${e.message}`] };
  }

  const { data, warnings } = validateAndFix(parsed);
  return { success: true, data, warnings };
}

// ─── Post-extraction validation & fixes ───────────────────────
/**
 * Validate and fix extracted data
 * @param {Object} raw - Raw extracted data from Claude
 * @returns {{ data: Object, warnings: string[] }}
 */
export function validateAndFix(raw) {
  const warnings = [];
  const data = { ...raw };

  // ── Ensure numeric amounts ──
  data.subtotal = ensureNumber(data.subtotal);
  data.tax_amount = ensureNumber(data.tax_amount);
  data.total = ensureNumber(data.total);

  // ── Fix amounts from line_items if total is 0 ──
  if (data.total === 0 && Array.isArray(data.line_items) && data.line_items.length > 0) {
    data.total = data.line_items.reduce((sum, item) => sum + ensureNumber(item.amount), 0);
    warnings.push("Total calculado desde line_items");
  }
  if (data.total === 0 && data.subtotal > 0) {
    data.total = data.subtotal + data.tax_amount;
    warnings.push("Total calculado como subtotal + tax_amount");
  }
  if (data.subtotal === 0 && data.total > 0) {
    if (data.tax_amount > 0) {
      data.subtotal = data.total - data.tax_amount;
    } else {
      data.subtotal = Math.round((data.total / 1.22) * 100) / 100;
      data.tax_amount = Math.round((data.total - data.subtotal) * 100) / 100;
      warnings.push("Subtotal e IVA estimados (22%)");
    }
  }

  // ── Validate amount coherence ──
  if (data.subtotal > 0 && data.tax_amount >= 0 && data.total > 0) {
    const expected = data.subtotal + data.tax_amount;
    const diff = Math.abs(expected - data.total);
    const tolerance = data.total * 0.05;
    if (diff > tolerance && diff > 1) {
      warnings.push(`Montos incoherentes: subtotal(${data.subtotal}) + tax(${data.tax_amount}) = ${expected}, pero total = ${data.total}`);
      if (data.confidence) data.confidence.total = Math.min(data.confidence.total || 1, 0.6);
    }
  }

  // ── Fix dates ──
  if (data.issue_date) data.issue_date = fixDate(data.issue_date, warnings);
  if (data.due_date) data.due_date = fixDate(data.due_date, warnings);

  // ── Validate date order ──
  if (data.issue_date && data.due_date && data.due_date < data.issue_date) {
    data.due_date = data.issue_date;
    if (data.confidence) data.confidence.due_date = Math.min(data.confidence.due_date || 1, 0.5);
    warnings.push("due_date anterior a issue_date, corregido");
  }

  // ── Validate RUT format ──
  if (data.emisor_rut) {
    const clean = data.emisor_rut.replace(/[\s.\-]/g, "");
    if (clean.length !== 12 && clean.length > 0) {
      warnings.push(`RUT emisor tiene ${clean.length} dígitos (esperado: 12)`);
      if (data.confidence) data.confidence.emisor_rut = Math.min(data.confidence.emisor_rut || 1, 0.5);
    }
  }

  // ── Validate date format ──
  if (data.issue_date && !isValidDate(data.issue_date)) {
    warnings.push(`Fecha emisión inválida: ${data.issue_date}`);
    data.issue_date = null;
    if (data.confidence) data.confidence.issue_date = 0;
  }
  if (data.due_date && !isValidDate(data.due_date)) {
    warnings.push(`Fecha vencimiento inválida: ${data.due_date}`);
    data.due_date = null;
    if (data.confidence) data.confidence.due_date = 0;
  }

  return { data, warnings };
}

// ─── Helpers ──────────────────────────────────────────────────

function ensureNumber(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return val;
  // Handle Uruguayan string format "3.235,01" → 3235.01
  let s = String(val).trim();
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function isValidDate(str) {
  if (!str) return false;
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  // Check actual date validity
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

function fixDate(dateStr, warnings) {
  if (!dateStr) return dateStr;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateStr;
  let year = parseInt(match[1]);
  const currentYear = new Date().getFullYear();

  // Fix common OCR confusion: 6↔0 in years
  if (year < currentYear - 2) {
    const fixed6 = parseInt(String(year).replace(/0/g, "6"));
    if (fixed6 >= currentYear - 1 && fixed6 <= currentYear + 1) {
      warnings.push(`Año corregido: ${year} → ${fixed6}`);
      year = fixed6;
    }
    const fixed0 = parseInt(String(year).replace(/6/g, "0"));
    if (fixed0 >= currentYear - 1 && fixed0 <= currentYear + 1) {
      warnings.push(`Año corregido: ${year} → ${fixed0}`);
      year = fixed0;
    }
  }
  if (year > currentYear + 2) {
    const fixed0 = parseInt(String(year).replace(/6/g, "0"));
    if (fixed0 >= currentYear - 1 && fixed0 <= currentYear + 1) {
      warnings.push(`Año corregido: ${year} → ${fixed0}`);
      year = fixed0;
    }
  }

  return `${year}-${match[2]}-${match[3]}`;
}
