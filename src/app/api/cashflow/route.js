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

// GET — list all cashflow projects for the user
export async function GET(req) {
  const auth = await authenticate(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = createUserClient(auth.token);
  const { data, error } = await db
    .from("cashflow_projects")
    .select("id, name, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

// POST — create a new cashflow project
export async function POST(req) {
  const auth = await authenticate(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();
  const { name, data: projectData } = body;
  if (!name || !projectData) {
    return NextResponse.json({ error: "name and data are required" }, { status: 400 });
  }

  const db = createUserClient(auth.token);
  const { data, error } = await db
    .from("cashflow_projects")
    .insert({ name, data: projectData })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

// PUT — update a cashflow project
export async function PUT(req) {
  const auth = await authenticate(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();
  const { id, name, data: projectData } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const updates = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (projectData !== undefined) updates.data = projectData;

  const db = createUserClient(auth.token);
  const { data, error } = await db
    .from("cashflow_projects")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

// DELETE — delete a cashflow project
export async function DELETE(req) {
  const auth = await authenticate(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const db = createUserClient(auth.token);
  const { error } = await db
    .from("cashflow_projects")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
