import { createServiceClient, createUserClient } from "@/lib/supabase-server";
import { extractInvoiceData } from "@/lib/extract";
import { NextResponse } from "next/server";

let storageClient = null;
function getStorageClient() {
  if (!storageClient) storageClient = createServiceClient();
  return storageClient;
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.replace("Bearer ", "");
    if (!accessToken) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: { user: authUser }, error: authErr } = await getStorageClient().auth.getUser(accessToken);
    if (authErr || !authUser?.id) {
      return NextResponse.json({ error: "Token inválido o expirado" }, { status: 401 });
    }

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
    const { data: fileData, error: dlErr } = await getStorageClient().storage
      .from("invoices")
      .download(file_path);

    if (dlErr || !fileData) {
      return NextResponse.json({ error: "No se pudo descargar el documento" }, { status: 500 });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const isPdf = file_path.endsWith(".pdf");
    const mimeType = isPdf ? "application/pdf" : file_path.endsWith(".png") ? "image/png" : "image/jpeg";

    // ─── AI Extraction (tool_use for structured output) ────
    const { success, data: extracted, warnings } = await extractInvoiceData(buffer, mimeType);

    if (!success || !extracted) {
      console.error("Re-extraction failed:", warnings);
      return NextResponse.json({ error: "Error procesando re-extracción", warnings }, { status: 500 });
    }

    if (warnings?.length > 0) {
      console.log("Re-extraction warnings:", warnings);
    }

    // Determine status
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
      const normalizedRut = extracted.emisor_rut.replace(/[\s.\-]/g, "");
      const { data: allSuppliers } = await supabase
        .from("suppliers")
        .select("id, tax_id");

      if (allSuppliers) {
        const rutMatch = allSuppliers.find(s =>
          s.tax_id && s.tax_id.replace(/[\s.\-]/g, "") === normalizedRut
        );
        if (rutMatch) {
          updates.supplier_id = rutMatch.id;
        }
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
      notes: `Re-extracción AI${warnings?.length ? ` | Warnings: ${warnings.join(", ")}` : ""}`,
    });

    return NextResponse.json({ success: true, extracted, updates, warnings });
  } catch (err) {
    console.error("Re-extract error:", err);
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}
