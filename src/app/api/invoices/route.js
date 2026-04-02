import { createServiceClient, createUserClient } from "@/lib/supabase-server";
import { extractInvoiceData } from "@/lib/extract";
import { NextResponse } from "next/server";
import crypto from "crypto";

// Lazy-initialized storage client (avoid module-level crashes on serverless)
let storageClient = null;
function getStorageClient() {
  if (!storageClient) storageClient = createServiceClient();
  return storageClient;
}

export async function POST(request) {
  try {
    // ─── Auth: extract user token ──────────────────────────
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.replace("Bearer ", "");
    if (!accessToken) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

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
      if (!uploadErr.message?.includes("not found")) {
        return NextResponse.json({ error: "Error subiendo archivo" }, { status: 500 });
      }
    }

    // ─── AI Extraction (tool_use for structured output) ────
    const { success, data: extracted, warnings } = await extractInvoiceData(buffer, file.type);

    if (!success || !extracted) {
      console.error("Extraction failed:", warnings);
      return NextResponse.json({ error: "No se pudo extraer datos — revisá que sea una factura legible", warnings }, { status: 500 });
    }

    if (warnings?.length > 0) {
      console.log("Extraction warnings:", warnings);
    }

    // ─── Match or create supplier (RUT exact → name fuzzy → create) ──
    const normalizeName = (name) => {
      if (!name) return "";
      return name
        .toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\b(S\.?A\.?S?|S\.?R\.?L\.?|LTDA\.?|S\.?A\.?|S\.?C\.?|SOCIEDAD ANONIMA|INC\.?|LLC\.?|LTD\.?)\b/g, "")
        .replace(/[.\-,]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    };

    const fuzzyNameMatch = (extractedName, existingName) => {
      const a = normalizeName(extractedName);
      const b = normalizeName(existingName);
      if (!a || !b) return false;
      return a.includes(b) || b.includes(a);
    };

    let supplierId = null;
    let supplierMatched = false;
    let supplierCreated = false;

    // Step 1: Match by RUT (exact)
    if (extracted.emisor_rut) {
      const normalizedRut = extracted.emisor_rut.replace(/[\s.\-]/g, "");
      const { data: allSuppliers } = await supabase
        .from("suppliers")
        .select("id, tax_id, name");

      if (allSuppliers) {
        const rutMatch = allSuppliers.find(s =>
          s.tax_id && s.tax_id.replace(/[\s.\-]/g, "") === normalizedRut
        );
        if (rutMatch) {
          supplierId = rutMatch.id;
          supplierMatched = true;
          console.log(`Supplier matched by RUT: ${normalizedRut} → ${rutMatch.id}`);
        }
      }
    }

    // Step 2: Match by name (fuzzy) if no RUT match
    if (!supplierId && extracted.emisor_nombre) {
      const { data: allSuppliers } = await supabase
        .from("suppliers")
        .select("id, name");

      if (allSuppliers) {
        const nameMatch = allSuppliers.find(s => fuzzyNameMatch(extracted.emisor_nombre, s.name));
        if (nameMatch) {
          supplierId = nameMatch.id;
          supplierMatched = true;
          console.log(`Supplier matched by name: "${extracted.emisor_nombre}" ≈ "${nameMatch.name}" → ${nameMatch.id}`);
        }
      }
    }

    // Step 3: Create new supplier only if no match at all
    if (!supplierId && (extracted.emisor_rut || extracted.emisor_nombre)) {
      const newSupplier = {
        name: extracted.emisor_nombre || "Proveedor Desconocido",
        alias: (extracted.emisor_nombre || "").split(/\s+(S\.?A\.?S?|S\.?R\.?L|LTDA|S\.?A\.?)/i)[0].trim() || extracted.emisor_nombre || "Nuevo",
        tax_id: extracted.emisor_rut || null,
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
        console.log(`New supplier created: "${newSupplier.name}" → ${createdSup.id}`);
      } else if (createErr) {
        console.error("Error creating supplier:", createErr.message, createErr.code, createErr.details, createErr.hint);
      }
    }

    // Determine initial status
    const hasLowConfidence = extracted.confidence && Object.values(extracted.confidence).some((v) => v !== null && v < 0.8);
    const initialStatus = hasLowConfidence ? "REVIEW_REQUIRED" : "EXTRACTED";

    // ─── Build and insert invoice ──────────────────────────
    const invoiceData = {
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

    // Log event (non-blocking)
    const { error: eventErr } = await supabase.from("invoice_events").insert({
      invoice_id: newInvoice.id,
      event_type: "created",
      from_status: null,
      to_status: initialStatus,
      notes: `Factura subida y extraída por AI — ${supplierMatched ? "Proveedor matcheado" : supplierCreated ? "Proveedor creado automáticamente" : "Sin proveedor"}${warnings?.length ? ` | Warnings: ${warnings.join(", ")}` : ""}`,
    });
    if (eventErr) console.error("Event insert error:", eventErr.message, eventErr.code, eventErr.details);

    // ─── Auto-link to recurring instance if supplier matches ──
    let recurringLinked = null;
    if (supplierId) {
      try {
        const currentPeriod = new Date().toISOString().slice(0, 7);
        const { data: matchedRecurring } = await supabase
          .from("recurring_expenses")
          .select("id, name")
          .eq("supplier_id", supplierId)
          .eq("active", true)
          .limit(1)
          .maybeSingle();

        if (matchedRecurring) {
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
        console.error("Recurring auto-link error:", linkError.message);
      }
    }

    return NextResponse.json({
      success: true,
      invoice: newInvoice,
      extracted,
      warnings,
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
    const isPayloadError = err.message?.includes("body") || err.message?.includes("size") || err.message?.includes("too large") || err.message?.includes("FUNCTION_PAYLOAD_TOO_LARGE");
    const isTimeout = err.message?.includes("timeout") || err.message?.includes("TIMEOUT") || err.message?.includes("deadline");
    const isRateLimit = err.status === 429 || err.message?.includes("rate");
    const friendlyMsg = isPayloadError ? "Archivo demasiado grande (máx ~3MB)"
      : isTimeout ? "La extracción tardó demasiado — intentá de nuevo"
      : isRateLimit ? "Demasiadas solicitudes — esperá unos segundos"
      : (err.message || "Error interno");
    return NextResponse.json({
      error: friendlyMsg,
      debug: { name: err.name, message: err.message, stack: err.stack?.split("\n").slice(0, 5).join("\n") },
    }, { status: isRateLimit ? 429 : 500 });
  }
}

// Increase timeout for file uploads with AI extraction (Vercel serverless)
export const maxDuration = 120;
