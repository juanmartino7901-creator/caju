import { createServiceClient, createUserClient } from "@/lib/supabase-server";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import crypto from "crypto";

// Lazy-initialized clients (avoid module-level crashes on serverless)
let anthropic = null;
let storageClient = null;

function getAnthropic() {
  if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropic;
}
function getStorageClient() {
  if (!storageClient) storageClient = createServiceClient();
  return storageClient;
}

// ─── Claude Vision extraction prompt ────────────────────────
const EXTRACTION_PROMPT = `Sos un extractor de datos de documentos financieros uruguayos. Podés recibir DOS tipos de documento:

1. FACTURAS (e-factura, CFE, ticket) — el caso más común
2. LIQUIDACIONES DE SUELDO (recibos de haberes) — reconocibles por campos como "Haberes", "Descuentos", "Líquido a Cobrar", "BPS", "IRPF", "Sueldo Básico", "Aportes Jubilatorios", "Fonasa", "FRL"

Analizá la imagen/documento, determiná qué tipo es, y extraé los campos en formato JSON estricto.

Respondé SOLO con un JSON válido, sin texto antes ni después. Campos:

{
  "doc_type": "invoice" o "payroll",
  "emisor_nombre": "Razón social del emisor (en facturas) o nombre de la empresa empleadora (en recibos de sueldo)",
  "emisor_rut": "RUT del emisor/empresa (12 dígitos)",
  "comprador_nombre": "Razón social del comprador (facturas) o nombre del empleado (recibos)",
  "comprador_rut": "RUT del comprador o CI del empleado",
  "invoice_number": "Número de factura (facturas) o 'LIQ-MES-AÑO-CI' para recibos (ej: LIQ-FEB-2026-5045804). MES en español 3 letras mayúsculas: ENE, FEB, MAR, ABR, MAY, JUN, JUL, AGO, SET, OCT, NOV, DIC",
  "invoice_series": "Serie (facturas) o 'LIQ' (recibos)",
  "issue_date": "Fecha de emisión (facturas) o último día del período liquidado (recibos), formato YYYY-MM-DD",
  "due_date": "Fecha de vencimiento o null. Para recibos de sueldo = issue_date",
  "currency": "UYU o USD",
  "subtotal": "Para facturas: monto sin IVA. Para recibos: total de haberes (sueldo bruto)",
  "tax_amount": "Para facturas: IVA. Para recibos: total de descuentos (BPS + IRPF + Fonasa + FRL + otros descuentos). SIEMPRE positivo",
  "total": "Para facturas: total a pagar. Para recibos: el LÍQUIDO A COBRAR (haberes - descuentos). Este es el monto que se paga",
  "cae": "CAE (solo facturas) o null",
  "payment_terms": "CONTADO, 30 días, etc. Para recibos: 'MENSUAL'",
  "line_items": [
    {"description": "texto", "quantity": 1, "unit_price": número, "amount": número}
  ],
  "confidence": {
    "emisor_nombre": 0.0-1.0,
    "emisor_rut": 0.0-1.0,
    "invoice_number": 0.0-1.0,
    "issue_date": 0.0-1.0,
    "due_date": 0.0-1.0,
    "total": 0.0-1.0,
    "tax_amount": 0.0-1.0,
    "currency": 0.0-1.0
  }
}

=== REGLAS PARA RECIBOS DE SUELDO ===
- emisor_nombre = nombre de la EMPRESA (ej: "Renenutet SAS"), NO del empleado
- invoice_number = "LIQ-MES-AÑO-CI" usando la CI del empleado sin puntos ni guiones (ej: "LIQ-FEB-2026-5045804")
- total = "Líquido a Cobrar" o "Neto a cobrar" — es lo que se deposita al empleado
- subtotal = Total de Haberes (sueldo bruto antes de descuentos)
- tax_amount = Total de Descuentos (BPS jubilatorio + IRPF + Fonasa + FRL + otros). Siempre positivo
- line_items: incluir cada concepto de haberes como item positivo (Sueldo Básico, Horas Extras, Presentismo, Aguinaldo, etc.) y cada descuento como item con amount NEGATIVO (BPS, IRPF, Fonasa, Anticipo, etc.)
- issue_date = último día del mes del período. Si dice "Febrero 2026" → 2026-02-28

=== REGLAS PARA FACTURAS ===
- IMPORTANTE: Los montos SIEMPRE como números con punto decimal. Convertí formato uruguayo (punto=miles, coma=decimal) a formato JSON: "3.235,01" → 3235.01, "1.500" → 1500, "450,50" → 450.50
- Si no hay un total explícito, sumá los line_items. Calculá subtotal = total - tax_amount
- Si hay subtotal e IVA pero no total, calculá total = subtotal + tax_amount
- Si solo hay un monto total, estimá subtotal e IVA (22% en Uruguay)
- Si dice CONTADO y no hay fecha de vencimiento, due_date = issue_date

=== REGLAS GENERALES ===
- Los montos SIEMPRE como números JSON (no strings). Formato uruguayo → JSON: "3.235,01" → 3235.01
- Si un campo no es legible, poné null y confidence 0.0
- El RUT uruguayo tiene 12 dígitos
- NUNCA devuelvas 0 para total si hay montos visibles en el documento`;

export async function POST(request) {
  try {
    // ─── Auth: extract user token ──────────────────────────
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.replace("Bearer ", "");
    if (!accessToken) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Use service client to verify the token and get user_id reliably.
    // supabase.auth.getUser(jwt) validates against Supabase Auth and returns the user.
    const { data: { user: authUser }, error: authErr } = await getStorageClient().auth.getUser(accessToken);
    if (authErr || !authUser?.id) {
      console.error("=== AUTH ERROR ===", authErr?.message, "user:", authUser);
      return NextResponse.json({ error: "Token inválido o expirado" }, { status: 401 });
    }
    const userId = authUser.id;
    console.log("Authenticated user:", userId);

    // User-scoped client for RLS-filtered queries
    const supabase = createUserClient(accessToken);

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Formato no soportado. Usá PDF, JPG o PNG." }, { status: 400 });
    }

    // Validate size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Archivo demasiado grande (máx 10MB)" }, { status: 400 });
    }

    // Read file as buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);

    // Check for duplicate (user-scoped: only checks this user's invoices)
    const { data: existing } = await supabase
      .from("invoices")
      .select("id")
      .eq("file_hash", fileHash)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Esta factura ya fue subida", duplicate_id: existing.id }, { status: 409 });
    }

    // Upload to Supabase Storage (uses service role for storage permissions)
    const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
    const filePath = `invoices/${Date.now()}_${fileHash}.${ext}`;

    const { error: uploadErr } = await getStorageClient().storage
      .from("invoices")
      .upload(filePath, buffer, { contentType: file.type, upsert: false });

    if (uploadErr) {
      console.error("Storage upload error:", uploadErr);
      // If bucket doesn't exist, continue without storage
      if (!uploadErr.message?.includes("not found")) {
        return NextResponse.json({ error: "Error subiendo archivo" }, { status: 500 });
      }
    }

    // ─── Call Claude Vision ──────────────────────────────────
    const base64 = buffer.toString("base64");

    let mediaType;
    if (file.type === "application/pdf") {
      mediaType = "application/pdf";
    } else if (file.type === "image/png") {
      mediaType = "image/png";
    } else if (file.type === "image/webp") {
      mediaType = "image/webp";
    } else {
      mediaType = "image/jpeg";
    }

    // Build the content for Claude
    const content = [];

    if (file.type === "application/pdf") {
      content.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64 },
      });
    } else {
      content.push({
        type: "image",
        source: { type: "base64", media_type: mediaType, data: base64 },
      });
    }

    content.push({ type: "text", text: EXTRACTION_PROMPT });

    const response = await getAnthropic().messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content }],
    });

    // Parse Claude's response
    const responseText = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    let extracted;
    try {
      // Try to extract JSON from the response (handle possible markdown fences)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      extracted = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error("Parse error:", parseErr, "Response:", responseText);
      return NextResponse.json({ error: "Error procesando la factura con AI", raw: responseText }, { status: 500 });
    }

    // ─── Post-extraction: parse amounts (handle Uruguayan format) ────
    const parseAmount = (val) => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'number') return val;
      // String: Uruguayan format "3.235,01" → 3235.01
      let s = String(val).trim();
      if (s.includes(',')) {
        // Has comma → treat as decimal separator, dots are thousands
        s = s.replace(/\./g, '').replace(',', '.');
      }
      const n = parseFloat(s);
      return isNaN(n) ? 0 : n;
    };

    extracted.subtotal = parseAmount(extracted.subtotal);
    extracted.tax_amount = parseAmount(extracted.tax_amount);
    extracted.total = parseAmount(extracted.total);

    // If total is 0 but we have line_items, sum them
    if (extracted.total === 0 && Array.isArray(extracted.line_items) && extracted.line_items.length > 0) {
      extracted.total = extracted.line_items.reduce((sum, item) => sum + parseAmount(item.amount), 0);
    }
    // If we have subtotal + tax but no total, calculate it
    if (extracted.total === 0 && extracted.subtotal > 0) {
      extracted.total = extracted.subtotal + extracted.tax_amount;
    }
    // If we have total but no subtotal, estimate from IVA
    if (extracted.subtotal === 0 && extracted.total > 0) {
      if (extracted.tax_amount > 0) {
        extracted.subtotal = extracted.total - extracted.tax_amount;
      } else {
        // Estimate 22% IVA (Uruguay standard)
        extracted.subtotal = Math.round((extracted.total / 1.22) * 100) / 100;
        extracted.tax_amount = Math.round((extracted.total - extracted.subtotal) * 100) / 100;
      }
    }

    // ─── Post-extraction validation & corrections ────────
    // Fix common OCR confusion: 6↔0 in years (2020 should be 2026, etc.)
    const fixDate = (dateStr) => {
      if (!dateStr) return dateStr;
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return dateStr;
      let year = parseInt(match[1]);
      const currentYear = new Date().getFullYear();
      // If year is suspiciously old (before 2023), try swapping 0↔6
      if (year < currentYear - 2) {
        const yearStr = String(year);
        const fixed = yearStr.replace(/0/g, '6');
        const fixedYear = parseInt(fixed);
        if (fixedYear >= currentYear - 1 && fixedYear <= currentYear + 1) {
          year = fixedYear;
        }
        const fixed2 = yearStr.replace(/6/g, '0');
        const fixedYear2 = parseInt(fixed2);
        if (fixedYear2 >= currentYear - 1 && fixedYear2 <= currentYear + 1) {
          year = fixedYear2;
        }
      }
      if (year > currentYear + 2) {
        const yearStr = String(year);
        const fixed = yearStr.replace(/6/g, '0');
        const fixedYear = parseInt(fixed);
        if (fixedYear >= currentYear - 1 && fixedYear <= currentYear + 1) {
          year = fixedYear;
        }
      }
      return `${year}-${match[2]}-${match[3]}`;
    };

    if (extracted.issue_date) extracted.issue_date = fixDate(extracted.issue_date);
    if (extracted.due_date) extracted.due_date = fixDate(extracted.due_date);

    // If due_date is before issue_date, it's likely wrong — set to issue_date
    if (extracted.issue_date && extracted.due_date && extracted.due_date < extracted.issue_date) {
      extracted.due_date = extracted.issue_date;
      if (extracted.confidence) extracted.confidence.due_date = 0.5;
    }

    // ─── Match or create supplier by RUT (user-scoped) ───────
    let supplierId = null;
    let supplierMatched = false;
    let supplierCreated = false;

    if (extracted.emisor_rut) {
      const { data: matchedSup } = await supabase
        .from("suppliers")
        .select("id")
        .eq("tax_id", extracted.emisor_rut)
        .maybeSingle();

      if (matchedSup) {
        supplierId = matchedSup.id;
        supplierMatched = true;
      } else {
        const newSupplier = {
          name: extracted.emisor_nombre || "Proveedor Desconocido",
          alias: (extracted.emisor_nombre || "").split(/\s+(S\.?A\.?S?|S\.?R\.?L|LTDA|S\.?A\.?)/i)[0].trim() || extracted.emisor_nombre || "Nuevo",
          tax_id: extracted.emisor_rut,
          category: "Servicios",
          payment_terms: extracted.payment_terms || "Contado",
          user_id: userId,
        };

        const { data: createdSup, error: createErr } = await supabase
          .from("suppliers")
          .insert(newSupplier)
          .select("id")
          .single();

        if (!createErr && createdSup) {
          supplierId = createdSup.id;
          supplierCreated = true;
        } else if (createErr) {
          console.error("Error creating supplier:", createErr.message, createErr.code, createErr.details, createErr.hint);
        }
      }
    }

    // Determine initial status
    const hasLowConfidence = extracted.confidence && Object.values(extracted.confidence).some((v) => v !== null && v < 0.8);
    const initialStatus = hasLowConfidence ? "REVIEW_REQUIRED" : "EXTRACTED";

    // ─── Build and insert invoice ──────────────────────────
    const invoiceData = {};
    invoiceData.file_path = filePath;
    invoiceData.file_hash = fileHash;
    invoiceData.status = initialStatus;
    invoiceData.supplier_id = supplierId;
    invoiceData.invoice_number = extracted.invoice_number || "—";
    invoiceData.invoice_series = extracted.invoice_series || "A";
    invoiceData.issue_date = extracted.issue_date || null;
    invoiceData.due_date = extracted.due_date || extracted.issue_date || null;
    invoiceData.currency = extracted.currency || "UYU";
    invoiceData.subtotal = extracted.subtotal || 0;
    invoiceData.tax_amount = extracted.tax_amount || 0;
    invoiceData.total = extracted.total || 0;
    invoiceData.confidence_scores = extracted.confidence || {};
    invoiceData.source = "upload";
    invoiceData.user_id = userId;

    console.log("=== PRE-INSERT v2 ===", "userId:", userId, "invoiceData.user_id:", invoiceData.user_id, "full:", JSON.stringify(invoiceData));

    if (!invoiceData.user_id) {
      return NextResponse.json({ error: "ABORT: user_id is null/undefined", userId, type: typeof userId }, { status: 500 });
    }

    const { data: newInvoice, error: insertErr } = await supabase
      .from("invoices")
      .insert(invoiceData)
      .select()
      .single();

    if (insertErr) {
      console.error("=== INVOICE INSERT ERROR ===");
      console.error("message:", insertErr.message);
      console.error("code:", insertErr.code);
      console.error("details:", insertErr.details);
      console.error("hint:", insertErr.hint);
      console.error("invoiceData:", JSON.stringify(invoiceData, null, 2));
      console.error("userId:", userId);
      return NextResponse.json({ error: "Error guardando factura", debug: { message: insertErr.message, code: insertErr.code, details: insertErr.details, hint: insertErr.hint } }, { status: 500 });
    }

    // Log event (non-blocking — don't fail the upload if event logging fails)
    const { error: eventErr } = await supabase.from("invoice_events").insert({
      invoice_id: newInvoice.id,
      event_type: "created",
      from_status: null,
      to_status: initialStatus,
      notes: `Factura subida y extraída por AI — ${supplierMatched ? "Proveedor matcheado" : supplierCreated ? "Proveedor creado automáticamente" : "Sin proveedor"}`,
    });
    if (eventErr) console.error("Event insert error:", eventErr.message, eventErr.code, eventErr.details);

    // ─── Auto-link to recurring instance if supplier matches ──
    let recurringLinked = null;
    if (supplierId) {
      try {
        const currentPeriod = new Date().toISOString().slice(0, 7); // "2026-03"
        // Find recurring expense for this supplier
        const { data: matchedRecurring } = await supabase
          .from("recurring_expenses")
          .select("id, name")
          .eq("supplier_id", supplierId)
          .eq("active", true)
          .limit(1)
          .maybeSingle();

        if (matchedRecurring) {
          // Find pending instance for current period
          const { data: pendingInstance } = await supabase
            .from("recurring_instances")
            .select("id")
            .eq("recurring_id", matchedRecurring.id)
            .eq("period", currentPeriod)
            .eq("status", "pending")
            .maybeSingle();

          if (pendingInstance) {
            const { error: linkErr } = await supabase
              .from("recurring_instances")
              .update({ status: "invoice_linked", invoice_id: newInvoice.id })
              .eq("id", pendingInstance.id);

            if (!linkErr) {
              recurringLinked = matchedRecurring.name;
              console.log(`Auto-linked invoice ${newInvoice.id} to recurring "${matchedRecurring.name}" instance ${pendingInstance.id}`);
            }
          }
        }
      } catch (linkError) {
        // Non-blocking — don't fail the upload
        console.error("Recurring auto-link error:", linkError.message);
      }
    }

    return NextResponse.json({
      success: true,
      invoice: newInvoice,
      extracted,
      supplier_matched: supplierMatched,
      supplier_created: supplierCreated,
      supplier_id: supplierId,
      supplier_name: extracted.emisor_nombre || null,
      recurring_linked: recurringLinked,
    });
  } catch (err) {
    console.error("=== INVOICE UPLOAD UNHANDLED ERROR ===");
    console.error("name:", err.name);
    console.error("message:", err.message);
    console.error("stack:", err.stack);
    // Detect body size / payload too large errors
    const isPayloadError = err.message?.includes("body") || err.message?.includes("size") || err.message?.includes("too large") || err.message?.includes("FUNCTION_PAYLOAD_TOO_LARGE");
    return NextResponse.json({
      error: isPayloadError ? "Archivo demasiado grande para procesar (máx ~4.5MB en Vercel)" : (err.message || "Error interno"),
      debug: { name: err.name, message: err.message, stack: err.stack?.split("\n").slice(0, 5).join("\n") },
    }, { status: 500 });
  }
}

// Increase timeout for file uploads with AI extraction (Vercel serverless)
export const maxDuration = 60;
