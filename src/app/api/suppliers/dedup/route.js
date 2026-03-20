import { NextResponse } from "next/server";
import { createServiceClient, createUserClient } from "@/lib/supabase-server";

function getToken(req) {
  const auth = req.headers.get("authorization") || "";
  return auth.replace("Bearer ", "").trim() || null;
}

async function authenticate(req) {
  const token = getToken(req);
  if (!token) return { error: "No token", status: 401 };
  const service = createServiceClient();
  const { data: { user }, error } = await service.auth.getUser(token);
  if (error || !user) return { error: "Invalid token", status: 401 };
  return { user, token };
}

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

// GET — preview duplicates (dry run)
// POST — execute deduplication
export async function GET(req) {
  const auth = await authenticate(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = createUserClient(auth.token);
  const { data: suppliers, error } = await db
    .from("suppliers")
    .select("id, name, tax_id, created_at")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const groups = findDuplicateGroups(suppliers || []);
  return NextResponse.json({
    success: true,
    total_suppliers: (suppliers || []).length,
    duplicate_groups: groups.length,
    duplicates_to_remove: groups.reduce((s, g) => s + g.duplicates.length, 0),
    groups: groups.map(g => ({
      keep: { id: g.keep.id, name: g.keep.name, tax_id: g.keep.tax_id },
      remove: g.duplicates.map(d => ({ id: d.id, name: d.name, tax_id: d.tax_id })),
      match_type: g.matchType,
    })),
  });
}

export async function POST(req) {
  const auth = await authenticate(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = createUserClient(auth.token);
  const { data: suppliers, error } = await db
    .from("suppliers")
    .select("id, name, tax_id, created_at")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const groups = findDuplicateGroups(suppliers || []);
  let reassigned = 0;
  let removed = 0;

  for (const group of groups) {
    const keepId = group.keep.id;
    const dupIds = group.duplicates.map(d => d.id);

    // Reassign invoices from duplicates to the kept supplier
    for (const dupId of dupIds) {
      const { count } = await db
        .from("invoices")
        .update({ supplier_id: keepId })
        .eq("supplier_id", dupId)
        .select("id", { count: "exact", head: true });
      reassigned += (count || 0);

      // Reassign recurring expenses too
      await db
        .from("recurring_expenses")
        .update({ supplier_id: keepId })
        .eq("supplier_id", dupId);

      // Delete the duplicate supplier
      const { error: delErr } = await db
        .from("suppliers")
        .delete()
        .eq("id", dupId);

      if (!delErr) removed++;
      else console.error(`Failed to delete supplier ${dupId}:`, delErr.message);
    }
  }

  return NextResponse.json({
    success: true,
    groups_merged: groups.length,
    duplicates_removed: removed,
    invoices_reassigned: reassigned,
  });
}

function findDuplicateGroups(suppliers) {
  const groups = [];
  const processed = new Set();

  // Pass 1: Group by normalized RUT
  const byRut = {};
  for (const s of suppliers) {
    if (!s.tax_id) continue;
    const normalizedRut = s.tax_id.replace(/[\s.\-]/g, "");
    if (!normalizedRut) continue;
    if (!byRut[normalizedRut]) byRut[normalizedRut] = [];
    byRut[normalizedRut].push(s);
  }
  for (const [rut, members] of Object.entries(byRut)) {
    if (members.length < 2) continue;
    const [keep, ...duplicates] = members; // oldest first (sorted by created_at)
    groups.push({ keep, duplicates, matchType: "rut" });
    members.forEach(m => processed.add(m.id));
  }

  // Pass 2: Group by normalized name (for those without RUT match)
  const remaining = suppliers.filter(s => !processed.has(s.id));
  const byName = {};
  for (const s of remaining) {
    const normalized = normalizeName(s.name);
    if (!normalized) continue;

    // Check if this name matches any existing group key
    let matched = false;
    for (const key of Object.keys(byName)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        byName[key].push(s);
        matched = true;
        break;
      }
    }
    if (!matched) {
      byName[normalized] = [s];
    }
  }
  for (const [name, members] of Object.entries(byName)) {
    if (members.length < 2) continue;
    const [keep, ...duplicates] = members;
    groups.push({ keep, duplicates, matchType: "name" });
  }

  return groups;
}
