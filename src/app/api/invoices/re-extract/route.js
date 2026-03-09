import { createServiceClient, createUserClient } from "../../../lib/supabase-server";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const storageClient = createServiceClient();

const EXTRACTION_PROMPT = `Sos un extractor de datos de facturas uruguayas (e-factura, CFE). Analizá esta imagen/documento y extraé los siguientes campos en formato JSON estricto.

Respondé SOLO con un JSON válido, sin texto antes ni después. Campos:

{
  "emisor_nombre": "Razón social del emisor",
  "emisor_rut": "RUT del emisor (12 dígitos)",
  "invoice_number": "Número de factura completo (ej: A 00017847)",
  "invoice_series": "Serie (ej: A, B, E)",
  "issue_date": "Fecha de emisión en formato YYYY-MM-DD",
  "due_date": "Fecha de vencimiento en formato YYYY-MM-DD o null si dice CONTADO o no tiene",
  "currency": "UYU o USD",
  "subtotal": número sin IVA,
  "tax_amount": número total de IVA,
  "total": número total a pagar,
  "payment_terms": "CONTADO, 15 días, 30 días, etc.",
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
- El RUT uruguayo tiene 12 dígitos`;

export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.replace("Bearer ", "");
    if (!accessToken) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Verify token and get user_id via Supabase Auth
    const { data: { user: authUser }, error: authErr } = await storageClient.auth.getUser(accessToken);
    if (authErr || !authUser?.id) {
      return NextResponse.json({ error: "Token inválido o expirado" }, { status: 401 });
    }
    const userId = authUser.id;

    const supabase = createUserClient(accessToken);

    const { invoice_id, file_path } = await request.json();

    if (!invoice_id || !file_path) {
      return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
    }

    // Verify the invoice belongs to this user
    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .select("id, supplier_id")
      .eq("id", invoice_id)
      .single();

    if (invErr || !inv) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }

    // Download file from storage
    const { data: fileData, error: dlErr } = await storageClient.storage
      .from("invoices")
      .download(file_path);

    if (dlErr || !fileData) {
      return NextResponse.json({ error: "No se pudo descargar el documento" }, { status: 500 });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const base64 = buffer.toString("base64");

    const isPdf = file_path.endsWith(".pdf");
    const mediaType = isPdf ? "application/pdf" : file_path.endsWith(".png") ? "image/png" : "image/jpeg";

    const content = [];
    if (isPdf) {
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } });
    } else {
      content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: base64 } });
    }
    content.push({ type: "text", text: EXTRACTION_PROMPT });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{ role: "user", content }],
    });

    const responseText = response.content.filter(b => b.type === "text").map(b => b.text).join("");

    let extracted;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      extracted = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ error: "Error procesando re-extracción" }, { status: 500 });
    }

    // Update the invoice with new extraction data
    const hasLowConfidence = extracted.confidence && Object.values(extracted.confidence).some(v => v !== null && v < 0.8);

    const updates = {
      invoice_number: extracted.invoice_number || "—",
      invoice_series: extracted.invoice_series || "A",
      issue_date: extracted.issue_date || null,
      due_date: extracted.due_date || extracted.issue_date || null,
      currency: extracted.currency || "UYU",
      subtotal: extracted.subtotal || 0,
      tax_amount: extracted.tax_amount || 0,
      total: extracted.total || 0,
      confidence_scores: extracted.confidence || {},
      status: hasLowConfidence ? "REVIEW_REQUIRED" : "EXTRACTED",
      updated_at: new Date().toISOString(),
    };

    // Match supplier by RUT if different
    if (extracted.emisor_rut) {
      const { data: matchedSup } = await supabase
        .from("suppliers")
        .select("id")
        .eq("tax_id", extracted.emisor_rut)
        .maybeSingle();

      if (matchedSup) {
        updates.supplier_id = matchedSup.id;
      }
    }

    const { error: updErr } = await supabase
      .from("invoices")
      .update(updates)
      .eq("id", invoice_id);

    if (updErr) {
      return NextResponse.json({ error: "Error actualizando factura" }, { status: 500 });
    }

    // Log event
    await supabase.from("invoice_events").insert({
      invoice_id: invoice_id,
      event_type: "re_extracted",
      notes: "Re-extracción AI solicitada por usuario",
    });

    return NextResponse.json({ success: true, extracted, updates });
  } catch (err) {
    console.error("Re-extract error:", err);
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}
