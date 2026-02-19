// ============================================================
// src/app/api/invoices/route.js
// Invoice upload + listing API
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================================
// GET /api/invoices — List invoices with filters
// ============================================================
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const supplier_id = searchParams.get('supplier_id');
  const due_from = searchParams.get('due_from');
  const due_to = searchParams.get('due_to');
  const search = searchParams.get('search');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  let query = supabase
    .from('invoices')
    .select(`
      *,
      supplier:suppliers(id, name, alias, tax_id, bank_name, bank_code, account_type, account_number),
      events:invoice_events(id, event_type, from_status, to_status, notes, created_at)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (status && status !== 'ALL') {
    query = query.eq('status', status);
  }
  if (supplier_id) {
    query = query.eq('supplier_id', supplier_id);
  }
  if (due_from) {
    query = query.gte('due_date', due_from);
  }
  if (due_to) {
    query = query.lte('due_date', due_to);
  }
  if (search) {
    query = query.or(`invoice_number.ilike.%${search}%,supplier_name_raw.ilike.%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    invoices: data,
    total: count,
    page,
    limit,
  });
}

// ============================================================
// POST /api/invoices — Upload new invoice
// ============================================================
export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const source = formData.get('source') || 'paper';
    const supplierHint = formData.get('supplier_hint') || null;
    const userId = formData.get('user_id'); // From auth middleware

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Read file
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name;
    const mimeType = file.type;
    const fileSize = buffer.length;

    // Generate SHA-256 hash
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Check for duplicate by hash
    const { data: existing } = await supabase
      .from('invoices')
      .select('id, status, invoice_number')
      .eq('file_hash', fileHash)
      .limit(1)
      .single();

    if (existing) {
      return NextResponse.json({
        error: 'Archivo duplicado',
        message: `Este archivo ya fue cargado (Factura: ${existing.invoice_number || existing.id})`,
        duplicate_id: existing.id,
        status: existing.status,
      }, { status: 409 });
    }

    // Upload file to Supabase Storage
    const datePrefix = new Date().toISOString().slice(0, 7); // YYYY-MM
    const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `INBOX/${datePrefix}/${fileHash.slice(0, 8)}_${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from('invoices')
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 });
    }

    // Create invoice record
    const { data: invoice, error: insertError } = await supabase
      .from('invoices')
      .insert({
        file_path: filePath,
        file_hash: fileHash,
        file_name: fileName,
        file_mime_type: mimeType,
        file_size_bytes: fileSize,
        source: source,
        source_detail: supplierHint,
        status: 'NEW',
        created_by: userId,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Log creation event
    await supabase.from('invoice_events').insert({
      invoice_id: invoice.id,
      event_type: 'created',
      to_status: 'NEW',
      performed_by: userId,
      notes: `Factura subida desde ${source}`,
    });

    // Trigger extraction asynchronously
    // In production this would be a background job queue
    // For MVP, we call it inline but don't await the result
    triggerExtraction(invoice.id, filePath, mimeType, supplierHint)
      .catch(err => console.error('Extraction failed:', err));

    return NextResponse.json({
      success: true,
      invoice: invoice,
      message: 'Factura cargada exitosamente. La extracción AI está en proceso.',
    }, { status: 201 });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================================
// Trigger AI extraction (runs asynchronously)
// ============================================================
async function triggerExtraction(invoiceId, filePath, mimeType, supplierHint) {
  // Update status to EXTRACTING
  await supabase
    .from('invoices')
    .update({ status: 'EXTRACTING' })
    .eq('id', invoiceId);

  try {
    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('invoices')
      .download(filePath);

    if (downloadError) throw downloadError;

    const buffer = Buffer.from(await fileData.arrayBuffer());

    // Call extraction
    const { extractInvoiceData, matchSupplier } = await import('@/lib/extract');
    const result = await extractInvoiceData(buffer, mimeType, supplierHint);

    if (!result.success) {
      await supabase.from('invoices').update({
        status: 'REVIEW_REQUIRED',
        extraction_errors: result.errors,
        extraction_model: result.model,
        extracted_at: new Date().toISOString(),
      }).eq('id', invoiceId);
      return;
    }

    const extracted = result.data;

    // Try to match supplier
    let supplierId = null;
    const matchedSupplier = await matchSupplier(
      supabase,
      extracted.supplier_name,
      extracted.supplier_tax_id
    );
    if (matchedSupplier) {
      supplierId = matchedSupplier.id;
    }

    // Update invoice with extracted data
    await supabase.from('invoices').update({
      status: result.status,
      supplier_id: supplierId,
      supplier_name_raw: extracted.supplier_name,
      supplier_tax_id_raw: extracted.supplier_tax_id,
      invoice_number: extracted.invoice_number,
      invoice_series: extracted.invoice_series,
      issue_date: extracted.issue_date,
      due_date: extracted.due_dates?.[0] || null,
      currency: extracted.currency || 'UYU',
      subtotal: extracted.subtotal,
      tax_amount: extracted.tax_amount,
      total: extracted.total,
      payment_terms: extracted.payment_terms,
      notes_extracted: extracted.notes,
      raw_extracted_text: result.raw_text,
      extraction_json: extracted,
      confidence_scores: result.confidence_scores,
      extraction_errors: result.errors.length > 0 ? result.errors : null,
      extraction_model: result.model,
      extracted_at: new Date().toISOString(),
    }).eq('id', invoiceId);

    // Insert line items if present
    if (extracted.items && extracted.items.length > 0) {
      const items = extracted.items.map((item, idx) => ({
        invoice_id: invoiceId,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        line_total: item.line_total,
        sort_order: idx,
      }));
      await supabase.from('invoice_items').insert(items);
    }

    // Log extraction event
    await supabase.from('invoice_events').insert({
      invoice_id: invoiceId,
      event_type: 'extracted',
      to_status: result.status,
      notes: `Extracción AI completada (${result.model}). Confianza promedio: ${
        Object.values(result.confidence_scores).length > 0
          ? Math.round(Object.values(result.confidence_scores).reduce((a, b) => a + b, 0) / Object.values(result.confidence_scores).length * 100)
          : '?'
      }%`,
      metadata: { confidence: result.confidence_scores },
    });

  } catch (error) {
    console.error('Extraction pipeline error:', error);
    await supabase.from('invoices').update({
      status: 'REVIEW_REQUIRED',
      extraction_errors: [error.message],
      extracted_at: new Date().toISOString(),
    }).eq('id', invoiceId);
  }
}
