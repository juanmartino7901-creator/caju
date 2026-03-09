import { createServiceClient, createUserClient } from "../../lib/supabase-server";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import crypto from "crypto";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Service role client — only for storage uploads (needs elevated permissions)
const storageClient = createServiceClient();

// ─── Claude Vision extraction prompt ────────────────────────
const EXTRACTION_PROMPT = `Sos un extractor de datos de facturas uruguayas (e-factura, CFE). Analizá esta imagen/documento y extraé los siguientes campos en formato JSON estricto.

Respondé SOLO con un JSON válido, sin texto antes ni después. Campos:

{
  "emisor_nombre": "Razón social del emisor",
  "emisor_rut": "RUT del emisor (12 dígitos)",
  "comprador_nombre": "Razón social del comprador",
  "comprador_rut": "RUT del comprador (12 dígitos)",
  "invoice_number": "Número de factura completo (ej: A 00017847)",
  "invoice_series": "Serie (ej: A, B, E)",
  "issue_date": "Fecha de emisión en formato YYYY-MM-DD",
  "due_date": "Fecha de vencimiento en formato YYYY-MM-DD o null si dice CONTADO o no tiene",
  "currency": "UYU o USD",
  "subtotal": número sin IVA (monto exento + monto gravado),
  "tax_amount": número total de IVA,
  "total": número total a pagar,
  "cae": "Número de CAE",
  "payment_terms": "CONTADO, 15 días, 30 días, etc.",
  "line_items": [
    {"description": "texto", "quantity": número, "unit_price": número, "amount": número}
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

Notas:
- Los montos son numéricos (no strings). Ej: 3235.01, no "3.235,01"
- Si un campo no es legible, poné null y confidence 0.0
- Si dice CONTADO y no hay fecha de vencimiento, due_date = issue_date
- El RUT uruguayo tiene 12 dígitos
- Separá monto exento y gravado si es posible para calcular subtotal`;

export async function POST(request) {
  try {
    // ─── Auth: extract user token ──────────────────────────
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.replace("Bearer ", "");
    if (!accessToken) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // User-scoped client (respects RLS — queries filtered by user_id)
    const supabase = createUserClient(accessToken);

    // Verify token and get user_id (needed for explicit inserts — DEFAULT auth.uid()
    // may not work reliably with server-side clients)
    const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authUser) {
      console.error("Auth error:", authErr);
      return NextResponse.json({ error: "Token inválido o expirado" }, { status: 401 });
    }
    const userId = authUser.id;

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

    const { error: uploadErr } = await storageClient.storage
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

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
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
        } else {
          console.error("Error creating supplier:", createErr);
        }
      }
    }

    // Determine initial status
    const hasLowConfidence = extracted.confidence && Object.values(extracted.confidence).some((v) => v !== null && v < 0.8);
    const initialStatus = hasLowConfidence ? "REVIEW_REQUIRED" : "EXTRACTED";

    // ─── Insert invoice with explicit user_id ─────────────
    const invoiceRow = {
      file_path: filePath,
      file_hash: fileHash,
      status: initialStatus,
      supplier_id: supplierId,
      invoice_number: extracted.invoice_number || "—",
      invoice_series: extracted.invoice_series || "A",
      issue_date: extracted.issue_date || null,
      due_date: extracted.due_date || extracted.issue_date || null,
      currency: extracted.currency || "UYU",
      subtotal: extracted.subtotal || 0,
      tax_amount: extracted.tax_amount || 0,
      total: extracted.total || 0,
      confidence_scores: extracted.confidence || {},
      source: "upload",
      user_id: userId,
    };

    const { data: newInvoice, error: insertErr } = await supabase
      .from("invoices")
      .insert(invoiceRow)
      .select()
      .single();

    if (insertErr) {
      console.error("Insert error:", insertErr.message, insertErr.code, insertErr.details, insertErr.hint);
      return NextResponse.json({ error: "Error guardando factura", debug: { message: insertErr.message, code: insertErr.code } }, { status: 500 });
    }

    // Log event
    await supabase.from("invoice_events").insert({
      invoice_id: newInvoice.id,
      event_type: "created",
      from_status: null,
      to_status: initialStatus,
      notes: `Factura subida y extraída por AI — ${supplierMatched ? "Proveedor matcheado" : supplierCreated ? "Proveedor creado automáticamente" : "Sin proveedor"}`,
    });

    return NextResponse.json({
      success: true,
      invoice: newInvoice,
      extracted,
      supplier_matched: supplierMatched,
      supplier_created: supplierCreated,
      supplier_id: supplierId,
      supplier_name: extracted.emisor_nombre || null,
    });
  } catch (err) {
    console.error("Invoice upload error:", err);
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}
