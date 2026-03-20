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

// GET — list instances for a period
export async function GET(req) {
  const auth = await authenticate(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period");
  if (!period) return NextResponse.json({ error: "period is required" }, { status: 400 });

  const db = createUserClient(auth.token);
  const { data, error } = await db
    .from("recurring_instances")
    .select("*")
    .eq("period", period)
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

// POST — create instances (single or batch for a month)
export async function POST(req) {
  const auth = await authenticate(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();
  const db = createUserClient(auth.token);

  // Batch mode: create instances for all active recurring expenses in a period
  if (body.batch && body.period) {
    // Get active recurring expenses for this user
    const { data: expenses, error: expErr } = await db
      .from("recurring_expenses")
      .select("id")
      .eq("active", true);

    if (expErr) return NextResponse.json({ error: expErr.message }, { status: 500 });
    if (!expenses?.length) return NextResponse.json({ success: true, data: [], created: 0 });

    // Check which already exist
    const { data: existing } = await db
      .from("recurring_instances")
      .select("recurring_id")
      .eq("period", body.period);

    const existingIds = new Set((existing || []).map(e => e.recurring_id));
    const toCreate = expenses
      .filter(e => !existingIds.has(e.id))
      .map(e => ({
        recurring_id: e.id,
        period: body.period,
        status: "pending",
        user_id: auth.user.id,
      }));

    if (!toCreate.length) {
      // Return existing instances
      const { data: allInstances } = await db
        .from("recurring_instances")
        .select("*")
        .eq("period", body.period)
        .order("created_at");
      return NextResponse.json({ success: true, data: allInstances || [], created: 0 });
    }

    const { data: created, error: createErr } = await db
      .from("recurring_instances")
      .insert(toCreate)
      .select();

    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });

    // Return all instances for the period
    const { data: allInstances } = await db
      .from("recurring_instances")
      .select("*")
      .eq("period", body.period)
      .order("created_at");

    return NextResponse.json({ success: true, data: allInstances || [], created: created.length });
  }

  // Single mode
  if (!body.recurring_id || !body.period) {
    return NextResponse.json({ error: "recurring_id and period are required" }, { status: 400 });
  }

  const { data, error } = await db
    .from("recurring_instances")
    .insert({
      recurring_id: body.recurring_id,
      period: body.period,
      status: body.status || "pending",
      user_id: auth.user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

// PATCH — update instance (status, invoice_id, paid info)
export async function PATCH(req) {
  const auth = await authenticate(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const updates = {};
  if (body.status !== undefined) updates.status = body.status;
  if (body.invoice_id !== undefined) updates.invoice_id = body.invoice_id;
  if (body.paid_date !== undefined) updates.paid_date = body.paid_date;
  if (body.paid_amount !== undefined) updates.paid_amount = body.paid_amount;
  if (body.notes !== undefined) updates.notes = body.notes;

  const db = createUserClient(auth.token);
  const { data, error } = await db
    .from("recurring_instances")
    .update(updates)
    .eq("id", body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}
