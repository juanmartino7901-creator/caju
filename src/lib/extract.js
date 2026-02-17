// ============================================================
// src/lib/extract.js
// AI Invoice Extraction using Claude Vision API
// ============================================================

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const EXTRACTION_PROMPT = `Eres un sistema experto en lectura de facturas uruguayas. 
Analiza la imagen/PDF de esta factura y extrae los datos en formato JSON.

REGLAS:
- Todos los campos son en español
- El RUT uruguayo tiene formato XX.XXX.XXX.XXXX
- Las fechas en formato YYYY-MM-DD
- Los montos son numéricos sin puntos de miles (usa punto decimal)
- La moneda por defecto es UYU (pesos uruguayos), a menos que diga USD o U$S
- Si un campo no es legible, ponelo como null
- Para cada campo, incluí un score de confianza entre 0.0 y 1.0

Respondé ÚNICAMENTE con JSON válido, sin markdown ni texto adicional.

Formato de respuesta:
{
  "supplier_name": "string o null",
  "supplier_tax_id": "string (RUT) o null",
  "invoice_number": "string o null",
  "invoice_series": "string o null",
  "issue_date": "YYYY-MM-DD o null",
  "due_dates": ["YYYY-MM-DD"],
  "currency": "UYU o USD",
  "subtotal": number o null,
  "tax_amount": number o null,
  "total": number o null,
  "payment_terms": "string o null",
  "items": [
    {
      "description": "string",
      "quantity": number,
      "unit": "string",
      "unit_price": number,
      "line_total": number
    }
  ],
  "notes": "string o null",
  "confidence": {
    "supplier_name": 0.0-1.0,
    "supplier_tax_id": 0.0-1.0,
    "invoice_number": 0.0-1.0,
    "issue_date": 0.0-1.0,
    "total": 0.0-1.0,
    "due_date": 0.0-1.0,
    "currency": 0.0-1.0,
    "tax_amount": 0.0-1.0
  },
  "raw_text": "texto completo extraído de la factura"
}`;

// Critical fields that must be present for EXTRACTED status
const CRITICAL_FIELDS = ['supplier_name', 'invoice_number', 'issue_date', 'total', 'currency'];
const CONFIDENCE_THRESHOLD = 0.75;

/**
 * Extract invoice data from an image or PDF using Claude Vision
 * @param {Buffer} fileBuffer - The file content
 * @param {string} mimeType - MIME type of the file
 * @param {string} supplierHint - Optional hint about the supplier
 * @returns {Object} Extraction result
 */
export async function extractInvoiceData(fileBuffer, mimeType, supplierHint = null) {
  try {
    const base64Data = fileBuffer.toString('base64');
    
    // Determine media type for Claude
    let mediaType = mimeType;
    if (mimeType === 'application/pdf') {
      mediaType = 'application/pdf';
    } else if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType)) {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }

    const userMessage = supplierHint 
      ? `Extraé los datos de esta factura. Pista del proveedor: "${supplierHint}"`
      : 'Extraé los datos de esta factura.';

    const content = [
      {
        type: mimeType === 'application/pdf' ? 'document' : 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64Data,
        },
      },
      {
        type: 'text',
        text: userMessage,
      },
    ];

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: EXTRACTION_PROMPT,
      messages: [
        {
          role: 'user',
          content: content,
        },
      ],
    });

    // Parse the response
    const responseText = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');

    // Clean JSON (remove possible markdown fences)
    const cleanJson = responseText
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    const extracted = JSON.parse(cleanJson);

    // Determine status based on extraction quality
    const status = determineStatus(extracted);

    return {
      success: true,
      data: extracted,
      status: status,
      model: 'claude-sonnet-4-20250514',
      raw_text: extracted.raw_text || '',
      confidence_scores: extracted.confidence || {},
      errors: [],
    };

  } catch (error) {
    console.error('Extraction error:', error);
    return {
      success: false,
      data: null,
      status: 'REVIEW_REQUIRED',
      model: 'claude-sonnet-4-20250514',
      raw_text: '',
      confidence_scores: {},
      errors: [error.message],
    };
  }
}

/**
 * Determine invoice status based on extraction quality
 */
function determineStatus(extracted) {
  if (!extracted) return 'REVIEW_REQUIRED';

  const confidence = extracted.confidence || {};
  
  // Check critical fields
  for (const field of CRITICAL_FIELDS) {
    const value = field === 'supplier_name' ? extracted.supplier_name :
                  field === 'invoice_number' ? extracted.invoice_number :
                  field === 'issue_date' ? extracted.issue_date :
                  field === 'total' ? extracted.total :
                  field === 'currency' ? extracted.currency : null;

    // Missing critical field
    if (value === null || value === undefined || value === '') {
      return 'REVIEW_REQUIRED';
    }

    // Low confidence on critical field
    if (confidence[field] !== undefined && confidence[field] < CONFIDENCE_THRESHOLD) {
      return 'REVIEW_REQUIRED';
    }
  }

  // Must have at least one due date
  if (!extracted.due_dates || extracted.due_dates.length === 0) {
    // Not critical enough to block, but flag it
    if (confidence.due_date !== undefined && confidence.due_date < CONFIDENCE_THRESHOLD) {
      return 'REVIEW_REQUIRED';
    }
  }

  return 'EXTRACTED';
}

/**
 * Match extracted supplier data to existing suppliers in DB
 * @param {Object} supabase - Supabase client
 * @param {string} supplierName - Extracted supplier name
 * @param {string} supplierTaxId - Extracted RUT
 * @returns {Object|null} Matched supplier or null
 */
export async function matchSupplier(supabase, supplierName, supplierTaxId) {
  // First try exact RUT match
  if (supplierTaxId) {
    const normalized = supplierTaxId.replace(/[.\-\s]/g, '');
    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .eq('tax_id_normalized', normalized)
      .limit(1)
      .single();
    
    if (data) return data;
  }

  // Then try name similarity
  if (supplierName) {
    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .or(`name.ilike.%${supplierName}%,alias.ilike.%${supplierName}%`)
      .limit(1)
      .single();
    
    if (data) return data;
  }

  return null;
}
