"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { fmt, daysUntil, STATUSES } from "@/lib/utils";
import { Btn } from "@/components/SharedUI";
import Notifications from "@/components/Notifications";
import Dashboard from "@/components/Dashboard";
import Inbox from "@/components/Inbox";
import InvDetail from "@/components/InvoiceDetail";
import Payables from "@/components/Payables";
import RecurringView from "@/components/RecurringView";
import Suppliers from "@/components/Suppliers";
import SupDetail from "@/components/SupplierDetail";
import CashflowView from "@/components/CashflowView";
import ModuleLauncher from "@/components/ModuleLauncher";

// ─── Module registry ─────────────────────────────────────────
const MODULES = [
  { key: "pagos", label: "Gestión de Pagos", icon: "📄", description: "Facturas, proveedores, pagos y recurrentes" },
  { key: "cashflow", label: "Cashflow", icon: "📈", description: "Proyección de flujo de caja" },
];

// ─── Supabase Client (lazy singleton — avoids build-time crash) ──
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
  return _supabase;
}

const DEFAULT_CATEGORIES = ["Insumos", "Carnes", "Panificados", "Packaging", "Logística", "Servicios", "Alquiler", "Seguros", "Impuestos", "Suscripciones"];

function useIsMobile() {
  const [w, setW] = useState(1024);
  useEffect(() => {
    setW(window.innerWidth);
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w < 768;
}

const getSup = (suppliers, id) => suppliers.find(s => s.id === id) || {};

// ============================================================
// LOADING SCREEN
// ============================================================
function LoadingScreen() {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", background: "#f7f7fa" }}>
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}><span style={{ color: "#e85d04" }}>Caj</span>ú</div>
      <div style={{ width: 40, height: 40, margin: "0 auto 12px", border: "3px solid #e8e8ec", borderTopColor: "#e85d04", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <div style={{ fontSize: 13, color: "#8b8b9e" }}>Cargando datos...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  </div>;
}

function ErrorScreen({ error, onRetry }) {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", background: "#f7f7fa" }}>
    <div style={{ textAlign: "center", maxWidth: 400, padding: 20 }}>
      <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}><span style={{ color: "#e85d04" }}>Caj</span>ú</div>
      <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#dc2626", marginBottom: 6 }}>Error de conexión</div>
      <div style={{ fontSize: 12, color: "#8b8b9e", marginBottom: 16, lineHeight: 1.5 }}>{error}</div>
      <Btn onClick={onRetry}>🔄 Reintentar</Btn>
    </div>
  </div>;
}

// ============================================================
// LOGIN SCREEN
// ============================================================
function LoginScreen({ onLogin }) {
  const [loggingIn, setLoggingIn] = useState(false);
  const handleGoogle = async () => { setLoggingIn(true); await onLogin(); };
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", background: "linear-gradient(135deg, #1a1a2e 0%, #2d2b55 100%)" }}>
    <div style={{ textAlign: "center", padding: 40, background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", maxWidth: 360, width: "90%" }}>
      <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 4 }}><span style={{ color: "#e85d04" }}>Caj</span>ú</div>
      <div style={{ fontSize: 11, color: "#e85d04", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 28 }}>PLATAFORMA</div>
      <button onClick={handleGoogle} disabled={loggingIn} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", padding: "12px 20px", borderRadius: 10, border: "1px solid #e0e0e6", background: "#fff", fontSize: 14, fontWeight: 600, cursor: loggingIn ? "wait" : "pointer", color: "#1a1a2e", transition: "all 0.15s", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        {loggingIn ? "Conectando..." : "Iniciar sesión con Google"}
      </button>
      <div style={{ fontSize: 11, color: "#b0b0c0", marginTop: 16 }}>Solo usuarios autorizados</div>
    </div>
    <style>{`
      * { box-sizing: border-box; margin: 0; padding: 0; }
      button { font-family: inherit; }
    `}</style>
  </div>;
}

// ============================================================
// MAIN APP
// ============================================================
export default function Home() {
  const mobile = useIsMobile();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeModule, setActiveModule] = useState(null);
  const [view, setView] = useState("dashboard");
  const [selectedId, setSelectedId] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [filters, setFilters] = useState({ status: "ALL", search: "" });
  const [notification, setNotification] = useState(null);
  const [paySelection, setPaySelection] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [categories, setCategories] = useState(() => {
    if (typeof window !== "undefined") {
      try { const s = localStorage.getItem("caju_categories"); if (s) return JSON.parse(s); } catch {}
    }
    return DEFAULT_CATEGORIES;
  });
  const updateCategories = useCallback((newCats) => {
    setCategories(newCats);
    try { localStorage.setItem("caju_categories", JSON.stringify(newCats)); } catch {}
  }, []);

  // ─── Auth ────────────────────────────────────────────────
  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
      if (session?.user) {
        getSupabase().from("profiles").select("role").eq("id", session.user.id).single()
          .then(({ data }) => { if (data?.role) setUserRole(data.role); });
      }
    });
    const { data: { subscription } } = getSupabase().auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        getSupabase().from("profiles").select("role").eq("id", session.user.id).single()
          .then(({ data }) => { if (data?.role) setUserRole(data.role); });
      } else {
        setUserRole(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    await getSupabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const signOut = async () => {
    await getSupabase().auth.signOut();
    setUser(null);
  };

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuario";
  const userInitial = userName.charAt(0).toUpperCase();
  const userAvatar = user?.user_metadata?.avatar_url;
  const ROLE_LABELS = { admin: "Admin", employee: "Empleado", viewer: "Visor" };
  const userRoleLabel = ROLE_LABELS[userRole] || user?.email || "";

  // ─── Fetch from Supabase ─────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: supData, error: supErr } = await getSupabase().from("suppliers").select("*").order("name");
      if (supErr) throw supErr;

      const { data: invData, error: invErr } = await getSupabase()
        .from("invoices")
        .select(`*, invoice_events ( id, event_type, performed_by, created_at, notes )`)
        .order("due_date", { ascending: true });
      if (invErr) throw invErr;

      const { data: recData, error: recErr } = await getSupabase().from("recurring_expenses").select("*").order("day_of_month", { ascending: true });
      if (recErr) throw recErr;

      const mappedSuppliers = (supData || []).map(s => ({
        id: s.id, name: s.name, alias: s.alias || s.name, tax_id: s.tax_id || s.rut || "",
        category: s.category || "Servicios", bank: s.bank_name || s.bank || "—",
        account_type: s.account_type || "—", account_number: s.account_number || "—",
        currency: s.currency || "UYU", phone: s.phone || "—", email: s.email || "—",
        contact: s.contact_name || s.contact || "—", payment_terms: s.payment_terms || "30 días", notes: s.notes || "",
      }));

      const mappedInvoices = (invData || []).map(inv => ({
        id: inv.id, supplier_id: inv.supplier_id,
        invoice_number: inv.invoice_number || inv.number || "—", series: inv.invoice_series || inv.series || "A",
        issue_date: inv.issue_date, due_date: inv.due_date, currency: inv.currency || "UYU",
        subtotal: inv.subtotal ?? (inv.total ? inv.total - Math.round(inv.total * 0.22 / 1.22) : 0),
        tax_amount: inv.tax_amount ?? (inv.total ? Math.round(inv.total * 0.22 / 1.22) : 0),
        total: inv.total || 0, status: (inv.status || "NEW").toUpperCase(), source: inv.source || "email",
        confidence: inv.confidence_scores || inv.confidence || inv.extraction_confidence || {
          supplier_name: 0.95, tax_id: 0.92, invoice_number: 0.98,
          issue_date: 0.97, total: 0.99, due_date: 0.88, currency: 1.0, tax_amount: 0.90,
        },
        created_at: inv.created_at, payment_date: inv.payment_date || null,
        file_path: inv.file_path || null,
        file_type: inv.file_path ? (inv.file_path.endsWith(".pdf") ? "pdf" : "image") : null,
        events: (inv.invoice_events || []).map(e => ({
          type: e.event_type || "change",
          by: e.notes?.match(/por (.+)$/)?.[1] || "Sistema",
          at: e.created_at ? e.created_at.split("T")[0] : "",
          note: e.notes || e.event_type || "",
        })),
      }));

      const mappedRecurring = (recData || []).map(r => ({
        id: r.id, type: r.type || r.expense_type || "fixed_cost",
        name: r.name || r.description || "", amount: r.estimated_amount || r.amount || 0,
        currency: r.currency || "UYU", frequency: r.frequency || "monthly",
        day: r.day_of_month || r.day || 1, category: r.category || "Servicios",
        active: r.active !== false, supplier_id: r.supplier_id || null,
        variable: r.variable || r.is_variable || false,
        total_installments: r.total_installments || undefined,
        current_installment: r.current_installment || undefined,
        card_last4: r.credit_card_last4 || r.card_last4 || "",
      }));

      setSuppliers(mappedSuppliers);
      setInvoices(mappedInvoices);
      setRecurring(mappedRecurring);
    } catch (err) {
      console.error("Cajú: Error fetching data", err);
      setError(err.message || "No se pudo conectar a la base de datos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user) fetchData(); else setLoading(false); }, [fetchData, user]);

  // ─── Notification & Nav ──────────────────────────────────
  const notify = useCallback((msg, type = "success", linkId = null) => { setNotification({ msg, type, linkId }); setTimeout(() => setNotification(null), type === "error" ? 5000 : type === "supplier_created" ? 6000 : 2500); }, []);
  const nav = useCallback((v, id = null) => { setView(v); setSelectedId(id); }, []);

  // ─── Update invoice ──────────────────────────────────────
  const updateInvoice = useCallback(async (id, updates) => {
    if (updates.status === "PAID" && !updates.payment_date) {
      updates.payment_date = new Date().toISOString().split("T")[0];
    }
    const snapshot = invoices.find(inv => inv.id === id);
    setInvoices(prev => prev.map(inv => inv.id === id ? {
      ...inv, ...updates,
      events: [...inv.events, { type: "change", by: userName, at: new Date().toISOString().split("T")[0], note: `→ ${STATUSES[updates.status]?.label}` }]
    } : inv));
    notify(`Factura → ${STATUSES[updates.status]?.label}`);

    try {
      const dbUpdates = { status: updates.status, updated_at: new Date().toISOString() };
      if (updates.status === "PAID") dbUpdates.payment_date = updates.payment_date;
      if (updates.supplier_id !== undefined) dbUpdates.supplier_id = updates.supplier_id;
      if (updates.invoice_number !== undefined) dbUpdates.invoice_number = updates.invoice_number;
      if (updates.issue_date !== undefined) dbUpdates.issue_date = updates.issue_date;
      if (updates.due_date !== undefined) dbUpdates.due_date = updates.due_date;
      if (updates.subtotal !== undefined) dbUpdates.subtotal = updates.subtotal;
      if (updates.tax_amount !== undefined) dbUpdates.tax_amount = updates.tax_amount;
      if (updates.total !== undefined) dbUpdates.total = updates.total;
      if (updates.currency !== undefined) dbUpdates.currency = updates.currency;

      const { error: updErr } = await getSupabase().from("invoices").update(dbUpdates).eq("id", id);
      if (updErr) throw updErr;
      await getSupabase().from("invoice_events").insert({
        invoice_id: id, event_type: "status_change",
        notes: `→ ${STATUSES[updates.status]?.label || "Editado"} por ${userName}`,
      });
    } catch (err) {
      console.error("Cajú: Error updating invoice", err);
      if (snapshot) { setInvoices(prev => prev.map(inv => inv.id === id ? snapshot : inv)); }
      notify("Error al guardar cambio — se revirtió", "error");
    }
  }, [notify, userName, invoices]);

  const stats = useMemo(() => {
    const pending = invoices.filter(i => ["EXTRACTED", "REVIEW_REQUIRED", "APPROVED", "SCHEDULED"].includes(i.status));
    const overdue = pending.filter(i => daysUntil(i.due_date) < 0);
    const due7 = pending.filter(i => { const d = daysUntil(i.due_date); return d >= 0 && d <= 7; });
    const payable = invoices.filter(i => ["APPROVED", "SCHEDULED"].includes(i.status));
    const monthlyFixed = recurring.filter(r => r.active).reduce((s, r) => s + r.amount, 0);
    return { pending, overdue, due7, payable, inbox: invoices.filter(i => ["NEW", "REVIEW_REQUIRED"].includes(i.status)).length, totalPending: pending.reduce((s, i) => s + i.total, 0), monthlyFixed };
  }, [invoices, recurring]);

  const selInv = selectedId && view === "inbox" ? invoices.find(i => i.id === selectedId) : null;
  const selSup = selectedId && view === "suppliers" ? suppliers.find(s => s.id === selectedId) : null;

  // ─── Delete functions ───────────────────────────────────
  const deleteInvoice = useCallback(async (id) => {
    if (!confirm("¿Eliminar esta factura? Esta acción no se puede deshacer.")) return;
    try {
      await getSupabase().from("invoice_events").delete().eq("invoice_id", id);
      const { error } = await getSupabase().from("invoices").delete().eq("id", id);
      if (error) throw error;
      setInvoices(prev => prev.filter(i => i.id !== id));
      notify("Factura eliminada");
      nav("inbox");
    } catch (err) {
      console.error("Delete invoice error:", err);
      notify("Error al eliminar factura", "error");
    }
  }, [notify, nav]);

  const deleteSupplier = useCallback(async (id) => {
    const hasInvoices = invoices.some(i => i.supplier_id === id);
    if (hasInvoices) { notify("No se puede eliminar: tiene facturas asociadas", "error"); return; }
    if (!confirm("¿Eliminar este proveedor?")) return;
    try {
      const { error } = await getSupabase().from("suppliers").delete().eq("id", id);
      if (error) throw error;
      setSuppliers(prev => prev.filter(s => s.id !== id));
      notify("Proveedor eliminado");
      nav("suppliers");
    } catch (err) {
      console.error("Delete supplier error:", err);
      notify("Error al eliminar proveedor", "error");
    }
  }, [invoices, notify, nav]);

  const deleteRecurring = useCallback(async (id) => {
    if (!confirm("¿Eliminar este gasto recurrente?")) return;
    try {
      const { error } = await getSupabase().from("recurring_expenses").delete().eq("id", id);
      if (error) throw error;
      setRecurring(prev => prev.filter(r => r.id !== id));
      notify("Gasto eliminado");
    } catch (err) {
      console.error("Delete recurring error:", err);
      notify("Error al eliminar", "error");
    }
  }, [notify]);

  // ─── Batch actions ──────────────────────────────────────
  const batchUpdateInvoices = useCallback(async (ids, updates) => {
    const label = STATUSES[updates.status]?.label || "actualizado";
    if (!confirm(`¿${label} ${ids.length} factura(s)?`)) return false;
    try {
      for (const id of ids) {
        await getSupabase().from("invoices").update({ status: updates.status, updated_at: new Date().toISOString() }).eq("id", id);
        await getSupabase().from("invoice_events").insert({ invoice_id: id, event_type: "status_change", notes: `→ ${label} por ${userName} (lote)` });
      }
      setInvoices(prev => prev.map(inv => ids.includes(inv.id) ? {
        ...inv, ...updates,
        events: [...inv.events, { type: "change", by: userName, at: new Date().toISOString().split("T")[0], note: `→ ${label} (lote)` }]
      } : inv));
      notify(`${ids.length} factura(s) → ${label}`);
      return true;
    } catch (err) {
      console.error("Batch update error:", err);
      notify("Error al actualizar facturas", "error");
      return false;
    }
  }, [notify, userName]);

  const batchDeleteInvoices = useCallback(async (ids) => {
    if (!confirm(`¿Eliminar ${ids.length} factura(s)? Esta acción no se puede deshacer.`)) return false;
    try {
      for (const id of ids) {
        await getSupabase().from("invoice_events").delete().eq("invoice_id", id);
        await getSupabase().from("invoices").delete().eq("id", id);
      }
      setInvoices(prev => prev.filter(i => !ids.includes(i.id)));
      notify(`${ids.length} factura(s) eliminada(s)`);
      return true;
    } catch (err) {
      console.error("Batch delete invoices error:", err);
      notify("Error al eliminar facturas", "error");
      return false;
    }
  }, [notify]);

  const batchDeleteSuppliers = useCallback(async (ids) => {
    const withInvoices = ids.filter(id => invoices.some(i => i.supplier_id === id));
    if (withInvoices.length > 0) { notify(`${withInvoices.length} proveedor(es) tienen facturas asociadas y no se pueden eliminar`, "error"); return false; }
    if (!confirm(`¿Eliminar ${ids.length} proveedor(es)?`)) return false;
    try {
      for (const id of ids) { await getSupabase().from("suppliers").delete().eq("id", id); }
      setSuppliers(prev => prev.filter(s => !ids.includes(s.id)));
      notify(`${ids.length} proveedor(es) eliminado(s)`);
      return true;
    } catch (err) {
      console.error("Batch delete suppliers error:", err);
      notify("Error al eliminar proveedores", "error");
      return false;
    }
  }, [invoices, notify]);

  // ─── Re-extract invoice via AI ─────────────────────────
  const reExtractInvoice = useCallback(async (invoiceId, filePath) => {
    const { data: { session } } = await getSupabase().auth.getSession();
    const res = await fetch("/api/invoices/re-extract", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ invoice_id: invoiceId, file_path: filePath }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error re-extracting");
    await fetchData();
    return data;
  }, [fetchData]);

  // ─── Global Upload State ────────────────────────────────
  const [uploadState, setUploadState] = useState({
    active: false,      // upload in progress
    total: 0,
    processed: 0,
    ok: 0,
    errors: 0,
    linkedRecurring: 0,
    results: null,      // final report: { ok: [...], failed: [...], linked: [...] }
    dismissed: false,    // user closed the report
  });
  const uploadRunning = useRef(false);

  const startUpload = useCallback(async (files) => {
    if (!files || files.length === 0 || uploadRunning.current) return;
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    const valid = Array.from(files).filter(f => allowed.includes(f.type) && f.size <= 10 * 1024 * 1024);
    if (valid.length === 0) { notify("Ningún archivo válido", "error"); return; }

    uploadRunning.current = true;
    setUploadState({ active: true, total: valid.length, processed: 0, ok: 0, errors: 0, linkedRecurring: 0, results: null, dismissed: false });

    const okList = [];
    const failList = [];
    const linkedList = [];

    // Process in batches of 3
    const CONCURRENCY = 3;
    const TIMEOUT = 60000;

    const processOne = async (file) => {
      const { data: { session } } = await getSupabase().auth.getSession();
      const formData = new FormData();
      formData.append("file", file);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT);
      try {
        const res = await fetch("/api/invoices", {
          method: "POST",
          body: formData,
          headers: { Authorization: `Bearer ${session?.access_token}` },
          signal: controller.signal,
        });
        clearTimeout(timer);
        const data = await res.json();
        if (!res.ok) {
          return { success: false, name: file.name, error: data.error || `Error ${res.status}` };
        }
        const result = { success: true, name: file.name };
        if (data.supplier_created) result.supplierCreated = data.supplier_name;
        if (data.recurring_linked) result.recurringLinked = data.recurring_linked;
        return result;
      } catch (err) {
        clearTimeout(timer);
        if (err.name === "AbortError") return { success: false, name: file.name, error: "Timeout (60s)", retry: true };
        return { success: false, name: file.name, error: err.message || "Error de red" };
      }
    };

    let i = 0;
    const runBatch = async () => {
      while (i < valid.length) {
        const batch = valid.slice(i, i + CONCURRENCY);
        i += batch.length;
        const results = await Promise.all(batch.map(async (file) => {
          let result = await processOne(file);
          // Retry once on timeout
          if (!result.success && result.retry) {
            result = await processOne(file);
          }
          return result;
        }));

        for (const r of results) {
          if (r.success) {
            okList.push(r);
            if (r.recurringLinked) linkedList.push(r.recurringLinked);
          } else {
            failList.push(r);
          }
        }

        setUploadState(prev => ({
          ...prev,
          processed: okList.length + failList.length,
          ok: okList.length,
          errors: failList.length,
          linkedRecurring: linkedList.length,
        }));
      }
    };

    await runBatch();

    setUploadState(prev => ({
      ...prev,
      active: false,
      results: { ok: okList, failed: failList, linked: linkedList },
    }));
    uploadRunning.current = false;
    if (okList.length > 0) fetchData();
  }, [notify, fetchData]);

  const dismissUpload = useCallback(() => {
    setUploadState({ active: false, total: 0, processed: 0, ok: 0, errors: 0, linkedRecurring: 0, results: null, dismissed: true });
  }, []);

  // ─── Auth / Loading / Error screens ────────────────────
  if (authLoading) return <LoadingScreen />;
  if (!user) return <LoginScreen onLogin={signInWithGoogle} />;
  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen error={error} onRetry={fetchData} />;

  // ─── Launcher ─────────────────────────────────────────
  const goToLauncher = () => { setActiveModule(null); setView("dashboard"); setSelectedId(null); };

  if (!activeModule) {
    return <ModuleLauncher
      modules={MODULES}
      onSelect={setActiveModule}
      userName={userName}
      userInitial={userInitial}
      userAvatar={userAvatar}
      userRoleLabel={userRoleLabel}
      onSignOut={signOut}
      mobile={mobile}
    />;
  }

  // ─── Module: Cashflow ─────────────────────────────────
  if (activeModule === "cashflow") {
    return (
      <div style={{ minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", background: "#f7f7fa", color: "#1a1a2e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: mobile ? "12px 12px 0" : "16px 22px 0" }}>
          <button onClick={goToLauncher} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#8b8b9e", padding: "6px 0" }}>
            <span style={{ fontSize: 16 }}>←</span>
            <span style={{ fontSize: 15, fontWeight: 800 }}><span style={{ color: "#e85d04" }}>Caj</span>ú</span>
          </button>
          <span style={{ color: "#d1d1d8" }}>|</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>Cashflow</span>
        </div>
        <div style={{ padding: mobile ? 12 : 22 }}>
          <CashflowView supabase={getSupabase()} mobile={mobile} notify={notify} />
        </div>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes spin { to { transform: rotate(360deg); } }
          input, select, textarea { font-family: inherit; font-size: 16px; }
          button { font-family: inherit; }
        `}</style>
      </div>
    );
  }

  // ─── Module: Gestión de Pagos ─────────────────────────
  const navItems = [
    { key: "dashboard", label: "Dashboard", icon: "📊" },
    { key: "inbox", label: "Inbox", icon: "📥", badge: stats.inbox },
    { key: "payables", label: "Pagos", icon: "💰", badge: stats.payable.length },
    { key: "recurring", label: "Fijos", icon: "🔄" },
    { key: "suppliers", label: "Proveedores", icon: "🏢" },
  ];

  const BottomNav = () => <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #e8e8ec", display: "flex", zIndex: 100, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
    <button onClick={goToLauncher} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 0 6px", border: "none", background: "transparent", cursor: "pointer", color: "#8b8b9e" }}>
      <span style={{ fontSize: 18 }}>⬅</span>
      <span style={{ fontSize: 9, fontWeight: 600 }}>Módulos</span>
    </button>
    {navItems.map(it => (
      <button key={it.key} onClick={() => nav(it.key)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 0 6px", border: "none", background: "transparent", cursor: "pointer", color: view === it.key ? "#e85d04" : "#8b8b9e", position: "relative" }}>
        <span style={{ fontSize: 18 }}>{it.icon}</span>
        <span style={{ fontSize: 9, fontWeight: 600 }}>{it.label}</span>
        {it.badge > 0 && <span style={{ position: "absolute", top: 4, right: "calc(50% - 16px)", background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 700, padding: "0 4px", borderRadius: 6, minWidth: 14, textAlign: "center" }}>{it.badge}</span>}
      </button>
    ))}
  </div>;

  const Sidebar = () => <nav style={{ width: 200, background: "#1a1a2e", color: "#fff", display: "flex", flexDirection: "column", padding: "14px 0", flexShrink: 0 }}>
    <div style={{ padding: "0 14px 16px", borderBottom: "1px solid #2a2a4e" }}>
      <button onClick={goToLauncher} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "block" }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em" }}><span style={{ color: "#e85d04" }}>Caj</span><span style={{ color: "#fff" }}>ú</span></div>
        <div style={{ fontSize: 9, color: "#e85d04", marginTop: 1, letterSpacing: "0.06em" }}>GESTIÓN DE PAGOS</div>
      </button>
    </div>
    <div style={{ flex: 1, padding: "8px 6px", display: "flex", flexDirection: "column", gap: 1 }}>
      {navItems.map(it => (
        <button key={it.key} onClick={() => nav(it.key)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "none", borderRadius: 7, cursor: "pointer", width: "100%", textAlign: "left", background: view === it.key ? "#2a2a4e" : "transparent", color: view === it.key ? "#fff" : "#8b8b9e", fontSize: 13, fontWeight: view === it.key ? 600 : 400 }}>
          <span style={{ fontSize: 14 }}>{it.icon}</span>{it.label}
          {it.badge > 0 && <span style={{ marginLeft: "auto", background: "#e85d04", color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 8 }}>{it.badge}</span>}
        </button>
      ))}
    </div>
    <div style={{ padding: "10px 14px", borderTop: "1px solid #2a2a4e" }}>
      <button onClick={goToLauncher} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "7px 10px", border: "none", borderRadius: 7, cursor: "pointer", background: "transparent", color: "#8b8b9e", fontSize: 12, fontWeight: 500, marginBottom: 8 }}>
        <span style={{ fontSize: 14 }}>←</span> Todos los módulos
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 7, paddingTop: 8, borderTop: "1px solid #2a2a4e" }}>
        {userAvatar ? <img src={userAvatar} alt="" style={{ width: 28, height: 28, borderRadius: 7 }} referrerPolicy="no-referrer" /> : <div style={{ width: 28, height: 28, borderRadius: 7, background: "#e85d04", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{userInitial}</div>}
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</div><div style={{ fontSize: 9, color: "#e85d04" }}>{userRoleLabel}</div></div>
        <button onClick={signOut} title="Cerrar sesión" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#8b8b9e", padding: 4 }}>⏻</button>
      </div>
    </div>
  </nav>;

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", background: "#f7f7fa", color: "#1a1a2e" }}>
      {!mobile && <Sidebar />}

      <main style={{ flex: 1, overflow: "auto", overflowX: "hidden", padding: mobile ? "12px 12px 72px" : 22, minWidth: 0 }}>
        {mobile && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "4px 0" }}>
          <button onClick={goToLauncher} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <span style={{ fontSize: 17, fontWeight: 800 }}><span style={{ color: "#e85d04" }}>Caj</span>ú</span>
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={signOut} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#8b8b9e", fontWeight: 600 }}>Salir</button>
            {userAvatar ? <img src={userAvatar} alt="" style={{ width: 28, height: 28, borderRadius: 7 }} referrerPolicy="no-referrer" /> : <div style={{ width: 28, height: 28, borderRadius: 7, background: "#e85d04", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>{userInitial}</div>}
          </div>
        </div>}

        <Notifications notification={notification} nav={nav} setNotification={setNotification} mobile={mobile} />

        {view === "dashboard" && <Dashboard stats={stats} invoices={invoices} recurring={recurring} suppliers={suppliers} nav={nav} mobile={mobile} />}
        {view === "inbox" && !selInv && <Inbox invoices={invoices} suppliers={suppliers} filters={filters} setFilters={setFilters} nav={nav} notify={notify} mobile={mobile} onInvoiceUploaded={fetchData} onBatchUpdate={batchUpdateInvoices} onBatchDelete={batchDeleteInvoices} supabase={getSupabase()} uploadState={uploadState} onStartUpload={startUpload} onDismissUpload={dismissUpload} />}
        {view === "inbox" && selInv && <InvDetail inv={selInv} sup={getSup(suppliers, selInv.supplier_id)} suppliers={suppliers} onBack={() => nav("inbox")} onUpdate={updateInvoice} onDelete={deleteInvoice} notify={notify} mobile={mobile} onReExtract={reExtractInvoice} supabase={getSupabase()} />}
        {view === "payables" && <Payables invoices={invoices} suppliers={suppliers} recurring={recurring} onUpdate={updateInvoice} sel={paySelection} setSel={setPaySelection} notify={notify} mobile={mobile} />}
        {view === "recurring" && <RecurringView recurring={recurring} setRecurring={setRecurring} suppliers={suppliers} invoices={invoices} onDelete={deleteRecurring} notify={notify} nav={nav} mobile={mobile} categories={categories} updateCategories={updateCategories} supabase={getSupabase()} />}
        {view === "suppliers" && !selSup && <Suppliers suppliers={suppliers} setSuppliers={setSuppliers} invoices={invoices} nav={nav} mobile={mobile} onBatchDelete={batchDeleteSuppliers} categories={categories} supabase={getSupabase()} />}
        {view === "suppliers" && selSup && <SupDetail sup={selSup} invs={invoices.filter(i => i.supplier_id === selSup.id)} suppliers={suppliers} setSuppliers={setSuppliers} onBack={() => nav("suppliers")} onDelete={deleteSupplier} notify={notify} mobile={mobile} categories={categories} supabase={getSupabase()} />}
      </main>

      {mobile && <BottomNav />}

      {/* ─── Global Upload Banner ──────────────────────── */}
      {(uploadState.active || (uploadState.results && !uploadState.dismissed)) && (
        <div style={{ position: "fixed", bottom: mobile ? 56 : 16, left: mobile ? 8 : 216, right: mobile ? 8 : 16, zIndex: 200, animation: "fadeIn 0.2s ease" }}>
          {/* Progress banner (during upload) */}
          {uploadState.active && (
            <div onClick={() => nav("inbox")} style={{ background: "#1a1a2e", color: "#fff", borderRadius: 12, padding: "12px 16px", boxShadow: "0 8px 24px rgba(0,0,0,0.2)", cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Subiendo facturas: {uploadState.processed}/{uploadState.total}{uploadState.errors > 0 ? ` \u2014 ${uploadState.errors} error${uploadState.errors > 1 ? "es" : ""}` : ""}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#e85d04" }}>{uploadState.total > 0 ? Math.round((uploadState.processed / uploadState.total) * 100) : 0}%</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 4, height: 6, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "#e85d04", borderRadius: 4, width: `${uploadState.total > 0 ? Math.round((uploadState.processed / uploadState.total) * 100) : 0}%`, transition: "width 0.3s" }} />
              </div>
            </div>
          )}

          {/* Results report (after upload) */}
          {!uploadState.active && uploadState.results && !uploadState.dismissed && (
            <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", border: "1px solid #e8e8ec", maxHeight: mobile ? 300 : 400, overflow: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Reporte de carga</div>
                <button onClick={dismissUpload} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#8b8b9e", padding: 0 }}>{"\u2715"}</button>
              </div>

              {/* Summary */}
              <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                <div style={{ padding: "8px 12px", background: "#f7f7fa", borderRadius: 8, textAlign: "center", flex: 1, minWidth: 70 }}>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{uploadState.results.ok.length + uploadState.results.failed.length}</div>
                  <div style={{ fontSize: 10, color: "#8b8b9e", fontWeight: 600 }}>Total</div>
                </div>
                <div style={{ padding: "8px 12px", background: "#d1fae5", borderRadius: 8, textAlign: "center", flex: 1, minWidth: 70 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#10b981" }}>{uploadState.results.ok.length}</div>
                  <div style={{ fontSize: 10, color: "#10b981", fontWeight: 600 }}>Exitosas</div>
                </div>
                {uploadState.results.failed.length > 0 && <div style={{ padding: "8px 12px", background: "#fee2e2", borderRadius: 8, textAlign: "center", flex: 1, minWidth: 70 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#ef4444" }}>{uploadState.results.failed.length}</div>
                  <div style={{ fontSize: 10, color: "#ef4444", fontWeight: 600 }}>Fallidas</div>
                </div>}
                {uploadState.results.linked.length > 0 && <div style={{ padding: "8px 12px", background: "#dbeafe", borderRadius: 8, textAlign: "center", flex: 1, minWidth: 70 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#3b82f6" }}>{uploadState.results.linked.length}</div>
                  <div style={{ fontSize: 10, color: "#3b82f6", fontWeight: 600 }}>Auto-asociadas</div>
                </div>}
              </div>

              {/* Failed list */}
              {uploadState.results.failed.length > 0 && <>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", marginBottom: 4 }}>Fallidas:</div>
                {uploadState.results.failed.map((f, i) => (
                  <div key={i} style={{ fontSize: 11, padding: "4px 0", borderBottom: "1px solid #f3f3f6", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 500 }}>{f.name}</span>
                    <span style={{ color: "#ef4444", fontSize: 10 }}>{f.error}</span>
                  </div>
                ))}
              </>}

              {/* Ok list (collapsed by default if many) */}
              {uploadState.results.ok.length > 0 && <>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981", marginTop: 8, marginBottom: 4 }}>Exitosas:</div>
                {uploadState.results.ok.slice(0, 10).map((f, i) => (
                  <div key={i} style={{ fontSize: 11, padding: "3px 0", color: "#6b7280" }}>
                    {f.name}{f.recurringLinked ? ` \u2192 ${f.recurringLinked}` : ""}
                  </div>
                ))}
                {uploadState.results.ok.length > 10 && <div style={{ fontSize: 11, color: "#8b8b9e", padding: "4px 0" }}>...y {uploadState.results.ok.length - 10} m\u00e1s</div>}
              </>}

              <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                <button onClick={dismissUpload} style={{ padding: "6px 16px", borderRadius: 8, border: "none", background: "#e85d04", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cerrar</button>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { width: 30%; } 50% { width: 80%; } }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: #d1d1d8; border-radius: 2px; }
        input, select, textarea { font-family: inherit; font-size: 16px; }
        button { font-family: inherit; }
      `}</style>
    </div>
  );
}
