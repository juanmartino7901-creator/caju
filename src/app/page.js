"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { fmt, fmtDate as fmtDateShort, fmtDateFull, daysUntil, STATUSES, BANK_CODES } from "../lib/utils";
import { generateItauPaymentFile } from "../lib/itau-format";

// ============================================================
// CAJÚ — Complete MVP — Mobile Responsive — Supabase Connected
// ============================================================

// ─── Supabase Client ─────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const RECURRING_TYPES = {
  fixed_cost: { label: "Costo Fijo", icon: "📋", color: "#6366f1" },
  owner_withdrawal: { label: "Retiro Socio", icon: "👤", color: "#8b5cf6" },
  installment: { label: "Cuota Tarjeta", icon: "💳", color: "#f59e0b" },
};

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

// Helpers
const fmtDate = fmtDateShort;
const getSup = (suppliers, id) => suppliers.find(s => s.id === id) || {};

// ============================================================
// SHARED COMPONENTS
// ============================================================
const Badge = ({ status, size = "sm" }) => {
  const s = STATUSES[status] || STATUSES.NEW;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: size === "sm" ? "2px 7px" : "3px 10px", borderRadius: 6, fontSize: size === "sm" ? 10 : 12, fontWeight: 600, color: s.color, backgroundColor: s.bg, border: `1px solid ${s.color}22`, whiteSpace: "nowrap" }}>
    <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: s.color }}/>{s.label}
  </span>;
};

const DueBadge = ({ d }) => {
  const days = daysUntil(d); if (days === null) return null;
  let color, bg, text;
  if (days < 0) { color = "#dc2626"; bg = "#fef2f2"; text = `${Math.abs(days)}d atrás`; }
  else if (days === 0) { color = "#dc2626"; bg = "#fef2f2"; text = "Hoy"; }
  else if (days <= 3) { color = "#f59e0b"; bg = "#fffbeb"; text = `${days}d`; }
  else if (days <= 7) { color = "#3b82f6"; bg = "#eff6ff"; text = `${days}d`; }
  else { color = "#6b7280"; bg = "#f9fafb"; text = `${days}d`; }
  return <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 5px", borderRadius: 4, color, backgroundColor: bg, whiteSpace: "nowrap" }}>{text}</span>;
};

const Card = ({ children, style, onClick, hover, ...p }) => {
  const [h, setH] = useState(false);
  return <div onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8ec", padding: 16, transition: "all 0.15s", cursor: onClick ? "pointer" : "default", boxShadow: h && hover ? "0 4px 16px rgba(0,0,0,0.06)" : "0 1px 2px rgba(0,0,0,0.02)", ...style }} {...p}>{children}</div>;
};

const Btn = ({ children, variant = "primary", size = "md", ...p }) => {
  const base = { display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 8, fontWeight: 600, cursor: "pointer", transition: "all 0.15s", border: "none", whiteSpace: "nowrap" };
  const sizes = { sm: { padding: "5px 10px", fontSize: 11 }, md: { padding: "8px 14px", fontSize: 13 }, lg: { padding: "12px 20px", fontSize: 14 } };
  const variants = {
    primary: { background: "#e85d04", color: "#fff" },
    secondary: { background: "#fff", color: "#1a1a2e", border: "1px solid #e0e0e6" },
    danger: { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" },
    success: { background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0" },
    ghost: { background: "transparent", color: "#e85d04" },
  };
  return <button {...p} style={{ ...base, ...sizes[size], ...variants[variant], ...p.style }}>{children}</button>;
};

const Input = ({ label, ...p }) => <div style={{ width: "100%" }}>
  {label && <label style={{ fontSize: 11, fontWeight: 600, color: "#8b8b9e", display: "block", marginBottom: 3 }}>{label}</label>}
  <input {...p} style={{ width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid #e0e0e6", fontSize: 14, outline: "none", WebkitAppearance: "none", ...p.style }} />
</div>;

const Select = ({ label, children, ...p }) => <div style={{ width: "100%" }}>
  {label && <label style={{ fontSize: 11, fontWeight: 600, color: "#8b8b9e", display: "block", marginBottom: 3 }}>{label}</label>}
  <select {...p} style={{ width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid #e0e0e6", fontSize: 14, outline: "none", background: "#fff", ...p.style }}>{children}</select>
</div>;

const Progress = ({ current, total, color = "#e85d04" }) => <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
  <div style={{ flex: 1, height: 5, background: "#f1f1f5", borderRadius: 3, overflow: "hidden" }}>
    <div style={{ width: `${Math.round((current / total) * 100)}%`, height: "100%", background: color, borderRadius: 3 }}/>
  </div>
  <span style={{ fontSize: 10, color: "#8b8b9e", fontWeight: 600 }}>{current}/{total}</span>
</div>;

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
      <div style={{ fontSize: 11, color: "#e85d04", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 28 }}>GESTIÓN DE PAGOS</div>
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
      if (session?.user) {
        supabase.from("profiles").select("role").eq("id", session.user.id).single()
          .then(({ data }) => { if (data?.role) setUserRole(data.role); });
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        supabase.from("profiles").select("role").eq("id", session.user.id).single()
          .then(({ data }) => { if (data?.role) setUserRole(data.role); });
      } else {
        setUserRole(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
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
      // 1) Suppliers
      const { data: supData, error: supErr } = await supabase
        .from("suppliers")
        .select("*")
        .order("name");
      if (supErr) throw supErr;

      // 2) Invoices with events
      const { data: invData, error: invErr } = await supabase
        .from("invoices")
        .select(`
          *,
          invoice_events ( id, event_type, performed_by, created_at, notes )
        `)
        .order("due_date", { ascending: true });
      if (invErr) throw invErr;

      // 3) Recurring expenses
      const { data: recData, error: recErr } = await supabase
        .from("recurring_expenses")
        .select("*")
        .order("day_of_month", { ascending: true });
      if (recErr) throw recErr;

      // ─── Map DB rows → UI shape ──────────────────────────
      const mappedSuppliers = (supData || []).map(s => ({
        id: s.id,
        name: s.name,
        alias: s.alias || s.name,
        tax_id: s.tax_id || s.rut || "",
        category: s.category || "Servicios",
        bank: s.bank_name || s.bank || "—",
        account_type: s.account_type || "—",
        account_number: s.account_number || "—",
        currency: s.currency || "UYU",
        phone: s.phone || "—",
        email: s.email || "—",
        contact: s.contact_name || s.contact || "—",
        payment_terms: s.payment_terms || "30 días",
        notes: s.notes || "",
      }));

      const mappedInvoices = (invData || []).map(inv => ({
        id: inv.id,
        supplier_id: inv.supplier_id,
        invoice_number: inv.invoice_number || inv.number || "—",
        series: inv.invoice_series || inv.series || "A",
        issue_date: inv.issue_date,
        due_date: inv.due_date,
        currency: inv.currency || "UYU",
        subtotal: inv.subtotal ?? (inv.total ? inv.total - Math.round(inv.total * 0.22 / 1.22) : 0),
        tax_amount: inv.tax_amount ?? (inv.total ? Math.round(inv.total * 0.22 / 1.22) : 0),
        total: inv.total || 0,
        status: (inv.status || "NEW").toUpperCase(),
        source: inv.source || "email",
        confidence: inv.confidence_scores || inv.confidence || inv.extraction_confidence || {
          supplier_name: 0.95, tax_id: 0.92, invoice_number: 0.98,
          issue_date: 0.97, total: 0.99, due_date: 0.88, currency: 1.0, tax_amount: 0.90,
        },
        created_at: inv.created_at,
        payment_date: inv.payment_date || null,
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
        id: r.id,
        type: r.type || r.expense_type || "fixed_cost",
        name: r.name || r.description || "",
        amount: r.estimated_amount || r.amount || 0,
        currency: r.currency || "UYU",
        frequency: r.frequency || "monthly",
        day: r.day_of_month || r.day || 1,
        category: r.category || "Servicios",
        active: r.active !== false,
        supplier_id: r.supplier_id || null,
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

  // ─── Notification & Nav (unchanged) ──────────────────────
  const notify = useCallback((msg, type = "success", linkId = null) => { setNotification({ msg, type, linkId }); setTimeout(() => setNotification(null), type === "error" ? 5000 : type === "supplier_created" ? 6000 : 2500); }, []);
  const nav = useCallback((v, id = null) => { setView(v); setSelectedId(id); }, []);

  // ─── Update invoice: write to Supabase then update local state ───
  const updateInvoice = useCallback(async (id, updates) => {
    // Auto-set payment_date when marking as PAID
    if (updates.status === "PAID" && !updates.payment_date) {
      updates.payment_date = new Date().toISOString().split("T")[0];
    }

    // Snapshot for rollback
    const snapshot = invoices.find(inv => inv.id === id);

    // Optimistic update
    setInvoices(prev => prev.map(inv => inv.id === id ? {
      ...inv, ...updates,
      events: [...inv.events, { type: "change", by: userName, at: new Date().toISOString().split("T")[0], note: `→ ${STATUSES[updates.status]?.label}` }]
    } : inv));
    notify(`Factura → ${STATUSES[updates.status]?.label}`);

    // Persist to Supabase
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

      const { error: updErr } = await supabase
        .from("invoices")
        .update(dbUpdates)
        .eq("id", id);
      if (updErr) throw updErr;

      // Log event
      await supabase.from("invoice_events").insert({
        invoice_id: id,
        event_type: "status_change",
        notes: `→ ${STATUSES[updates.status]?.label || "Editado"} por ${userName}`,
      });
    } catch (err) {
      console.error("Cajú: Error updating invoice", err);
      // Rollback to snapshot
      if (snapshot) {
        setInvoices(prev => prev.map(inv => inv.id === id ? snapshot : inv));
      }
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
      await supabase.from("invoice_events").delete().eq("invoice_id", id);
      const { error } = await supabase.from("invoices").delete().eq("id", id);
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
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
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
      const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);
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
        await supabase.from("invoices").update({ status: updates.status, updated_at: new Date().toISOString() }).eq("id", id);
        await supabase.from("invoice_events").insert({ invoice_id: id, event_type: "status_change", notes: `→ ${label} por ${userName} (lote)` });
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
        await supabase.from("invoice_events").delete().eq("invoice_id", id);
        await supabase.from("invoices").delete().eq("id", id);
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
      for (const id of ids) { await supabase.from("suppliers").delete().eq("id", id); }
      setSuppliers(prev => prev.filter(s => !ids.includes(s.id)));
      notify(`${ids.length} proveedor(es) eliminado(s)`);
      return true;
    } catch (err) {
      console.error("Batch delete suppliers error:", err);
      notify("Error al eliminar proveedores", "error");
      return false;
    }
  }, [invoices, notify]);

  // ─── Auth / Loading / Error screens ────────────────────
  if (authLoading) return <LoadingScreen />;
  if (!user) return <LoginScreen onLogin={signInWithGoogle} />;
  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen error={error} onRetry={fetchData} />;

  const navItems = [
    { key: "dashboard", label: "Dashboard", icon: "📊" },
    { key: "inbox", label: "Inbox", icon: "📥", badge: stats.inbox },
    { key: "payables", label: "Pagos", icon: "💰", badge: stats.payable.length },
    { key: "recurring", label: "Fijos", icon: "🔄" },
    { key: "suppliers", label: "Proveedores", icon: "🏢" },
  ];

  const BottomNav = () => <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #e8e8ec", display: "flex", zIndex: 100, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
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
      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em" }}><span style={{ color: "#e85d04" }}>Caj</span>ú</div>
      <div style={{ fontSize: 9, color: "#e85d04", marginTop: 1, letterSpacing: "0.06em" }}>GESTIÓN DE PAGOS</div>
    </div>
    <div style={{ flex: 1, padding: "8px 6px", display: "flex", flexDirection: "column", gap: 1 }}>
      {navItems.map(it => (
        <button key={it.key} onClick={() => nav(it.key)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "none", borderRadius: 7, cursor: "pointer", width: "100%", textAlign: "left", background: view === it.key ? "#2a2a4e" : "transparent", color: view === it.key ? "#fff" : "#8b8b9e", fontSize: 13, fontWeight: view === it.key ? 600 : 400 }}>
          <span style={{ fontSize: 14 }}>{it.icon}</span>{it.label}
          {it.badge > 0 && <span style={{ marginLeft: "auto", background: "#e85d04", color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 8 }}>{it.badge}</span>}
        </button>
      ))}
    </div>
    <div style={{ padding: "10px 14px", borderTop: "1px solid #2a2a4e", display: "flex", alignItems: "center", gap: 7 }}>
      {userAvatar ? <img src={userAvatar} alt="" style={{ width: 28, height: 28, borderRadius: 7 }} referrerPolicy="no-referrer" /> : <div style={{ width: 28, height: 28, borderRadius: 7, background: "#e85d04", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{userInitial}</div>}
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</div><div style={{ fontSize: 9, color: "#e85d04" }}>{userRoleLabel}</div></div>
      <button onClick={signOut} title="Cerrar sesión" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#8b8b9e", padding: 4 }}>⏻</button>
    </div>
  </nav>;

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", background: "#f7f7fa", color: "#1a1a2e" }}>
      {!mobile && <Sidebar />}

      <main style={{ flex: 1, overflow: "auto", overflowX: "hidden", padding: mobile ? "12px 12px 72px" : 22, minWidth: 0 }}>
        {mobile && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "4px 0" }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}><span style={{ color: "#e85d04" }}>Caj</span>ú</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={signOut} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#8b8b9e", fontWeight: 600 }}>Salir</button>
            {userAvatar ? <img src={userAvatar} alt="" style={{ width: 28, height: 28, borderRadius: 7 }} referrerPolicy="no-referrer" /> : <div style={{ width: 28, height: 28, borderRadius: 7, background: "#e85d04", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>{userInitial}</div>}
          </div>
        </div>}

        {notification && <div onClick={() => { if (notification.linkId && notification.type === "supplier_created") { nav("suppliers", notification.linkId); setNotification(null); } }} style={{ position: "fixed", top: mobile ? 8 : 14, right: mobile ? 8 : 14, left: mobile ? 8 : "auto", zIndex: 999, padding: "10px 16px", borderRadius: 10, background: notification.type === "success" || notification.type === "supplier_created" ? "#059669" : "#ef4444", color: "#fff", fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", textAlign: "center", cursor: notification.linkId ? "pointer" : "default" }}>{notification.msg}</div>}

        {view === "dashboard" && <Dashboard stats={stats} invoices={invoices} recurring={recurring} suppliers={suppliers} nav={nav} mobile={mobile} />}
        {view === "inbox" && !selInv && <Inbox invoices={invoices} suppliers={suppliers} filters={filters} setFilters={setFilters} nav={nav} notify={notify} mobile={mobile} onInvoiceUploaded={fetchData} onBatchUpdate={batchUpdateInvoices} onBatchDelete={batchDeleteInvoices} />}
        {view === "inbox" && selInv && <InvDetail inv={selInv} sup={getSup(suppliers, selInv.supplier_id)} suppliers={suppliers} onBack={() => nav("inbox")} onUpdate={updateInvoice} onDelete={deleteInvoice} notify={notify} mobile={mobile} />}
        {view === "payables" && <Payables invoices={invoices} suppliers={suppliers} recurring={recurring} onUpdate={updateInvoice} sel={paySelection} setSel={setPaySelection} notify={notify} mobile={mobile} />}
        {view === "recurring" && <RecurringView recurring={recurring} setRecurring={setRecurring} suppliers={suppliers} onDelete={deleteRecurring} notify={notify} mobile={mobile} categories={categories} updateCategories={updateCategories} />}
        {view === "suppliers" && !selSup && <Suppliers suppliers={suppliers} setSuppliers={setSuppliers} invoices={invoices} nav={nav} mobile={mobile} onBatchDelete={batchDeleteSuppliers} categories={categories} />}
        {view === "suppliers" && selSup && <SupDetail sup={selSup} invs={invoices.filter(i => i.supplier_id === selSup.id)} suppliers={suppliers} setSuppliers={setSuppliers} onBack={() => nav("suppliers")} onDelete={deleteSupplier} notify={notify} mobile={mobile} categories={categories} />}
      </main>

      {mobile && <BottomNav />}

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

// ============================================================
// DASHBOARD
// ============================================================
function Dashboard({ stats, invoices, recurring, suppliers, nav, mobile }) {
  const byType = useMemo(() => {
    const r = { fixed: 0, withdrawal: 0, installment: 0 };
    recurring.filter(x => x.active).forEach(x => { if (x.type === "fixed_cost") r.fixed += x.amount; else if (x.type === "owner_withdrawal") r.withdrawal += x.amount; else r.installment += x.amount; });
    return r;
  }, [recurring]);

  return <div style={{ animation: "fadeIn 0.25s ease" }}>
    <div style={{ marginBottom: 14 }}>
      <h1 style={{ fontSize: mobile ? 20 : 22, fontWeight: 800 }}>Dashboard</h1>
      <p style={{ fontSize: 12, color: "#8b8b9e", marginTop: 2 }}>{new Date().toLocaleDateString("es-UY", { month: "long", year: "numeric" }).replace(/^\w/, c => c.toUpperCase())}</p>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
      <Card style={{ padding: 14 }}><div style={{ fontSize: 10, color: "#8b8b9e", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Pendiente</div><div style={{ fontSize: mobile ? 18 : 22, fontWeight: 800, marginTop: 4 }}>{fmt(stats.totalPending)}</div><div style={{ fontSize: 10, color: "#8b8b9e", marginTop: 2 }}>{stats.pending.length} facturas</div></Card>
      <Card style={{ padding: 14 }}><div style={{ fontSize: 10, color: "#8b8b9e", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Vencidas</div><div style={{ fontSize: mobile ? 18 : 22, fontWeight: 800, marginTop: 4, color: stats.overdue.length > 0 ? "#dc2626" : "#059669" }}>{stats.overdue.length}</div><div style={{ fontSize: 10, color: "#8b8b9e", marginTop: 2 }}>{stats.overdue.length > 0 ? "⚠️ Atención" : "✅ Al día"}</div></Card>
      <Card style={{ padding: 14 }}><div style={{ fontSize: 10, color: "#8b8b9e", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Vence 7d</div><div style={{ fontSize: mobile ? 18 : 22, fontWeight: 800, marginTop: 4 }}>{stats.due7.length}</div><div style={{ fontSize: 10, color: "#8b8b9e", marginTop: 2 }}>{fmt(stats.due7.reduce((s, i) => s + i.total, 0))}</div></Card>
      <Card style={{ padding: 14 }}><div style={{ fontSize: 10, color: "#8b8b9e", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Inbox</div><div style={{ fontSize: mobile ? 18 : 22, fontWeight: 800, marginTop: 4, color: "#e85d04" }}>{stats.inbox}</div><div style={{ fontSize: 10, color: "#8b8b9e", marginTop: 2 }}>Por procesar</div></Card>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 14 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>Obligaciones Mensuales</h3>
          <span style={{ fontSize: 16, fontWeight: 800, color: "#e85d04" }}>{fmt(stats.monthlyFixed)}</span>
        </div>
        {[["📋 Costos Fijos", byType.fixed], ["💳 Cuotas Tarjeta", byType.installment], ["👤 Retiro Socio", byType.withdrawal]].map(([l, v], i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 10px", background: "#f7f7fa", borderRadius: 7, marginBottom: 5, fontSize: 13 }}>
            <span style={{ color: "#6b7280" }}>{l}</span><span style={{ fontWeight: 700 }}>{fmt(v)}</span>
          </div>
        ))}
      </Card>

      <Card>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Próximos Vencimientos</h3>
        {stats.pending.filter(i => daysUntil(i.due_date) >= -5).sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).slice(0, 6).map(inv => {
          const sup = getSup(suppliers, inv.supplier_id);
          return <div key={inv.id} onClick={() => nav("inbox", inv.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #f3f3f6", cursor: "pointer" }}>
            <div><div style={{ fontSize: 13, fontWeight: 500 }}>{sup.alias}</div><div style={{ fontSize: 10, color: "#8b8b9e" }}>{inv.invoice_number}</div></div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 13, fontWeight: 700 }}>{fmt(inv.total, inv.currency)}</span><DueBadge d={inv.due_date} /></div>
          </div>;
        })}
      </Card>
    </div>

    <Card>
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Por Estado</h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {Object.entries(STATUSES).map(([k, s]) => {
          const c = invoices.filter(i => i.status === k).length;
          return c > 0 ? <div key={k} onClick={() => nav("inbox")} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", background: s.bg, borderRadius: 7, cursor: "pointer", border: `1px solid ${s.color}20` }}>
            <span style={{ fontSize: 11 }}>{s.icon}</span><span style={{ fontSize: 11, fontWeight: 600, color: s.color }}>{s.label} {c}</span>
          </div> : null;
        })}
      </div>
    </Card>
  </div>;
}

// ============================================================
// INBOX
// ============================================================
function Inbox({ invoices, suppliers, filters, setFilters, nav, notify, mobile, onInvoiceUploaded, onBatchUpdate, onBatchDelete }) {
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [sel, setSel] = useState(new Set());
  const [sortBy, setSortBy] = useState("recent"); // recent, due, amount_desc, amount_asc, supplier
  const filtered = useMemo(() => {
    let list = invoices;
    if (filters.status !== "ALL") list = list.filter(i => i.status === filters.status);
    if (filters.search) { const t = filters.search.toLowerCase(); list = list.filter(i => { const s = getSup(suppliers, i.supplier_id); return s.name?.toLowerCase().includes(t) || s.alias?.toLowerCase().includes(t) || i.invoice_number.toLowerCase().includes(t); }); }
    switch (sortBy) {
      case "due": return [...list].sort((a, b) => new Date(a.due_date || "2099-12-31") - new Date(b.due_date || "2099-12-31"));
      case "amount_desc": return [...list].sort((a, b) => b.total - a.total);
      case "amount_asc": return [...list].sort((a, b) => a.total - b.total);
      case "supplier": return [...list].sort((a, b) => (getSup(suppliers, a.supplier_id).alias || "").localeCompare(getSup(suppliers, b.supplier_id).alias || ""));
      case "issue": return [...list].sort((a, b) => new Date(b.issue_date || 0) - new Date(a.issue_date || 0));
      default: return [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  }, [invoices, filters, suppliers, sortBy]);

  const toggleSel = (id, e) => { e.stopPropagation(); setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const toggleAll = () => setSel(sel.size === filtered.length ? new Set() : new Set(filtered.map(i => i.id)));
  const selIds = [...sel];

  const handleBatchAction = async (action) => {
    let ok;
    if (action === "delete") { ok = await onBatchDelete(selIds); }
    else { ok = await onBatchUpdate(selIds, { status: action }); }
    if (ok) setSel(new Set());
  };

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    const valid = Array.from(files).filter(f => {
      if (!allowed.includes(f.type)) { notify(`${f.name}: formato no soportado`, "error"); return false; }
      if (f.size > 10 * 1024 * 1024) { notify(`${f.name}: demasiado grande (máx 10MB)`, "error"); return false; }
      return true;
    });
    if (valid.length === 0) return;

    setUploading(true);
    let ok = 0, fail = 0;
    const createdSuppliers = [];
    for (let i = 0; i < valid.length; i++) {
      const file = valid[i];
      setUploadProgress(`Procesando ${i + 1} de ${valid.length}: ${file.name}`);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/invoices", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 409) notify(`${file.name}: ya fue subida`, "error");
          else notify(`${file.name}: ${data.error || "error"}`, "error");
          fail++;
        } else {
          ok++;
          if (data.supplier_created && data.supplier_name) {
            createdSuppliers.push({ name: data.supplier_name, id: data.supplier_id });
          }
        }
      } catch (err) {
        console.error("Upload error:", err);
        fail++;
      }
    }

    setShowUpload(false);
    setUploading(false);
    setUploadProgress("");
    if (ok > 0) {
      notify(`✅ ${ok} factura(s) subida(s)${fail > 0 ? ` · ${fail} con error` : ""}`);
      if (onInvoiceUploaded) onInvoiceUploaded();
      createdSuppliers.forEach(s => {
        setTimeout(() => notify(`Proveedor "${s.name}" creado automáticamente — tocá para completar datos`, "supplier_created", s.id), 800);
      });
    } else {
      notify(`Error subiendo ${fail} factura(s)`, "error");
    }
  };

  const onFileSelect = (e) => { if (e.target.files?.length) handleUpload(e.target.files); e.target.value = ""; };
  const onDrop = (e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) handleUpload(e.dataTransfer.files); };

  return <div style={{ animation: "fadeIn 0.25s ease" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <h1 style={{ fontSize: mobile ? 20 : 22, fontWeight: 800 }}>Inbox</h1>
      <Btn size={mobile ? "sm" : "md"} onClick={() => setShowUpload(!showUpload)} disabled={uploading}>📤 Subir</Btn>
    </div>

    {showUpload && <Card
      style={{ marginBottom: 12, border: `2px dashed ${dragOver ? "#e85d04" : "#e0c4a8"}`, background: dragOver ? "#fff0e0" : "#fff8f3", textAlign: "center", padding: 24, transition: "all 0.15s" }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {uploading ? <>
        <div style={{ fontSize: 28, marginBottom: 8 }}>⚙️</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#e85d04" }}>{uploadProgress}</div>
        <div style={{ width: 120, height: 4, background: "#f1e8df", borderRadius: 2, margin: "12px auto 0", overflow: "hidden" }}>
          <div style={{ width: "60%", height: "100%", background: "#e85d04", borderRadius: 2, animation: "pulse 1.5s ease infinite" }} />
        </div>
      </> : <>
        <div style={{ fontSize: 32, marginBottom: 4, opacity: 0.3 }}>📄</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#e85d04" }}>Arrastrá archivos o tocá para seleccionar</div>
        <div style={{ fontSize: 11, color: "#8b8b9e", marginTop: 3 }}>PDF, JPG, PNG — Máx 10 MB — Podés subir varios a la vez</div>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 12, padding: "8px 16px", borderRadius: 8, background: "#e85d04", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          📁 Elegir archivo
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple onChange={onFileSelect} style={{ display: "none" }} />
        </label>
      </>}
    </Card>}

    <input type="text" placeholder="🔍  Buscar proveedor, número..." value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e0e0e6", fontSize: 14, outline: "none", marginBottom: 8 }} />

    <div style={{ display: "flex", gap: 5, marginBottom: 10, overflowX: "auto", paddingBottom: 4 }}>
      {["ALL", "NEW", "REVIEW_REQUIRED", "EXTRACTED", "APPROVED", "SCHEDULED", "PAID"].map(st => (
        <button key={st} onClick={() => { setFilters(f => ({ ...f, status: st })); setSel(new Set()); }} style={{ padding: "5px 9px", borderRadius: 6, border: "1px solid #e0e0e6", background: filters.status === st ? "#e85d04" : "#fff", color: filters.status === st ? "#fff" : "#6b7280", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
          {st === "ALL" ? "Todas" : STATUSES[st]?.label}
        </button>
      ))}
    </div>

    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, flexWrap: "wrap" }}>
        {filtered.length > 0 && <Btn variant="secondary" size="sm" onClick={toggleAll}>{sel.size === filtered.length ? "Deseleccionar" : `Seleccionar todo (${filtered.length})`}</Btn>}
        {sel.size > 0 && <>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#e85d04" }}>{sel.size} seleccionada(s)</span>
          <Btn variant="success" size="sm" onClick={() => handleBatchAction("APPROVED")}>✅ Aprobar</Btn>
          <Btn variant="primary" size="sm" onClick={() => handleBatchAction("EXTRACTED")}>✓ Extraída</Btn>
          <Btn variant="danger" size="sm" onClick={() => handleBatchAction("REJECTED")}>✕ Rechazar</Btn>
          <Btn variant="danger" size="sm" onClick={() => handleBatchAction("delete")}>🗑 Eliminar</Btn>
        </>}
      </div>
      <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #e0e0e6", fontSize: 11, fontWeight: 600, color: "#6b7280", background: "#fff", cursor: "pointer", flexShrink: 0 }}>
        <option value="recent">Más recientes</option>
        <option value="due">Vencimiento ↑</option>
        <option value="issue">Emisión ↓</option>
        <option value="amount_desc">Monto ↓</option>
        <option value="amount_asc">Monto ↑</option>
        <option value="supplier">Proveedor A-Z</option>
      </select>
    </div>

    {filtered.map(inv => {
      const sup = getSup(suppliers, inv.supplier_id);
      const checked = sel.has(inv.id);
      return <Card key={inv.id} hover onClick={() => nav("inbox", inv.id)} style={{ padding: mobile ? "12px 14px" : "10px 14px", marginBottom: 5, borderLeft: checked ? "3px solid #e85d04" : "3px solid transparent", background: checked ? "#fff8f3" : "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="checkbox" checked={checked} onChange={() => {}} onClick={(e) => { e.stopPropagation(); setSel(p => { const n = new Set(p); n.has(inv.id) ? n.delete(inv.id) : n.add(inv.id); return n; }); }} style={{ accentColor: "#e85d04", width: 16, height: 16, flexShrink: 0, cursor: "pointer" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sup.alias || sup.name || "Sin proveedor"}</span>
                  <Badge status={inv.status} />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#8b8b9e" }}>{inv.invoice_number}</span>
                  <span style={{ fontSize: 11, color: "#b0b0c0" }}>{fmtDate(inv.issue_date)}</span>
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{fmt(inv.total, inv.currency)}</div>
                <DueBadge d={inv.due_date} />
              </div>
            </div>
          </div>
        </div>
      </Card>;
    })}
    {filtered.length === 0 && invoices.length === 0 && <Card style={{ textAlign: "center", padding: 28 }}>
      <div style={{ fontSize: 32, opacity: 0.2 }}>📭</div>
      <div style={{ fontSize: 13, color: "#8b8b9e", marginTop: 4 }}>No tenés facturas todavía</div>
      <Btn size="sm" style={{ marginTop: 12 }} onClick={() => setShowUpload(true)}>📤 Subir tu primera factura</Btn>
    </Card>}
    {filtered.length === 0 && invoices.length > 0 && <Card style={{ textAlign: "center", padding: 28 }}>
      <div style={{ fontSize: 32, opacity: 0.2 }}>🔍</div>
      <div style={{ fontSize: 13, color: "#8b8b9e", marginTop: 4 }}>No se encontraron facturas con estos filtros</div>
      <Btn variant="secondary" size="sm" style={{ marginTop: 12 }} onClick={() => setFilters({ status: "ALL", search: "" })}>Limpiar filtros</Btn>
    </Card>}
  </div>;
}

// ============================================================
// DOCUMENT PREVIEW (loads from Supabase Storage)
// ============================================================
function DocPreview({ inv }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!inv.file_path) return;
    setLoading(true);
    setError(false);

    supabase.storage.from("invoices").createSignedUrl(inv.file_path, 3600)
      .then(({ data, error: signErr }) => {
        if (signErr || !data?.signedUrl) throw signErr || new Error("No signed URL");
        setUrl(data.signedUrl);
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [inv.file_path]);

  if (!inv.file_path) {
    return <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#fafafa", minHeight: 160 }}>
      <div style={{ fontSize: 40, opacity: 0.2, marginBottom: 4 }}>📄</div>
      <div style={{ fontSize: 12, color: "#8b8b9e" }}>Sin documento adjunto</div>
    </Card>;
  }

  return <Card style={{ display: "flex", flexDirection: "column", background: "#fafafa", minHeight: 160, overflow: "hidden" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700 }}>Documento</h3>
      {url && <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 600, color: "#e85d04", textDecoration: "none" }}>↗ Abrir</a>}
    </div>
    {loading ? (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 120 }}>
        <div style={{ width: 24, height: 24, border: "2px solid #e8e8ec", borderTopColor: "#e85d04", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <div style={{ fontSize: 11, color: "#8b8b9e", marginTop: 8 }}>Cargando preview...</div>
      </div>
    ) : error ? (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 120 }}>
        <div style={{ fontSize: 32, opacity: 0.3, marginBottom: 4 }}>⚠️</div>
        <div style={{ fontSize: 12, color: "#8b8b9e" }}>No se pudo cargar el documento</div>
        <div style={{ fontSize: 11, color: "#b0b0c0", marginTop: 2 }}>Verificá que el bucket "invoices" sea público en Supabase</div>
      </div>
    ) : url && inv.file_type === "pdf" ? (
      <iframe
        src={`${url}#toolbar=0`}
        style={{ flex: 1, width: "100%", minHeight: 300, border: "1px solid #e8e8ec", borderRadius: 8, background: "#fff" }}
        title="Preview factura"
      />
    ) : url ? (
      <img
        src={url}
        alt="Factura"
        style={{ width: "100%", maxHeight: 400, objectFit: "contain", borderRadius: 8, border: "1px solid #e8e8ec", background: "#fff" }}
        onError={() => setError(true)}
      />
    ) : null}
  </Card>;
}

// ============================================================
// INVOICE DETAIL
// ============================================================
function InvDetail({ inv, sup, suppliers, onBack, onUpdate, onDelete, notify, mobile }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    invoice_number: inv.invoice_number, issue_date: inv.issue_date || "", due_date: inv.due_date || "",
    subtotal: inv.subtotal, tax_amount: inv.tax_amount, total: inv.total, currency: inv.currency,
    supplier_id: inv.supplier_id || "",
  });

  const saveEdits = () => {
    const updates = { ...form, subtotal: Number(form.subtotal), tax_amount: Number(form.tax_amount), total: Number(form.total), status: inv.status };
    onUpdate(inv.id, updates);
    setEditing(false);
    notify("Datos actualizados");
  };

  const actions = [];
  if (["EXTRACTED", "REVIEW_REQUIRED"].includes(inv.status)) {
    actions.push({ label: "Aprobar", status: "APPROVED", variant: "success", icon: "✅" });
    actions.push({ label: "Disputa", status: "DISPUTE", variant: "danger", icon: "⚡" });
    actions.push({ label: "Rechazar", status: "REJECTED", variant: "danger", icon: "✕" });
  }
  if (["APPROVED", "SCHEDULED"].includes(inv.status)) actions.push({ label: "Pagada", status: "PAID", variant: "success", icon: "💰" });
  if (inv.status === "DISPUTE") { actions.push({ label: "Aprobar", status: "APPROVED", variant: "success", icon: "✅" }); actions.push({ label: "Rechazar", status: "REJECTED", variant: "danger", icon: "✕" }); }

  const fields = [
    ["Proveedor", sup.name || "— Sin asignar —", "supplier_name"], ["RUT", sup.tax_id || "—", "tax_id"], ["N° Factura", inv.invoice_number, "invoice_number"],
    ["Emisión", fmtDateFull(inv.issue_date), "issue_date"], ["Vencimiento", fmtDateFull(inv.due_date), "due_date"],
    ["Subtotal", fmt(inv.subtotal, inv.currency)], ["IVA", fmt(inv.tax_amount, inv.currency), "tax_amount"], ["Total", fmt(inv.total, inv.currency), "total"],
  ];

  return <div style={{ animation: "fadeIn 0.25s ease" }}>
    <Btn variant="ghost" onClick={onBack} size="sm" style={{ marginBottom: 10 }}>← Volver</Btn>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
      <div>
        <h1 style={{ fontSize: mobile ? 18 : 20, fontWeight: 800 }}>{sup.alias || sup.name || inv.invoice_number}</h1>
        <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#6b7280" }}>{inv.invoice_number}</span>
          <Badge status={inv.status} size="md" />
          <span style={{ fontSize: 10, color: "#8b8b9e", background: "#f7f7fa", padding: "2px 6px", borderRadius: 4 }}>📥 {inv.source}</span>
        </div>
      </div>
      <div style={{ textAlign: "right" }}><div style={{ fontSize: mobile ? 22 : 26, fontWeight: 800 }}>{fmt(inv.total, inv.currency)}</div><DueBadge d={inv.due_date} /></div>
    </div>

    {actions.length > 0 && <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
      {actions.map((a, i) => <Btn key={i} variant={a.variant} size={mobile ? "lg" : "md"} onClick={() => { if (confirm(`¿${a.label} esta factura?`)) onUpdate(inv.id, { status: a.status }); }} style={{ flex: mobile ? "1 1 auto" : undefined }}>{a.icon} {a.label}</Btn>)}
    </div>}

    <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 14 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700 }}>Datos Extraídos</h3>
          <Btn variant={editing ? "primary" : "secondary"} size="sm" onClick={() => { if (editing) saveEdits(); else { setForm({ invoice_number: inv.invoice_number, issue_date: inv.issue_date || "", due_date: inv.due_date || "", subtotal: inv.subtotal, tax_amount: inv.tax_amount, total: inv.total, currency: inv.currency, supplier_id: inv.supplier_id || "" }); setEditing(true); } }}>{editing ? "💾 Guardar" : "✏️ Editar"}</Btn>
        </div>
        {editing ? <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Select label="Proveedor" value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}>
            <option value="">— Sin asignar —</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.alias || s.name} ({s.tax_id})</option>)}
          </Select>
          <Input label="N° Factura" value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} />
          <Input label="Emisión" type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
          <Input label="Vencimiento" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
          <Input label="Subtotal" type="number" value={form.subtotal} onChange={e => setForm(f => ({ ...f, subtotal: e.target.value }))} />
          <Input label="IVA" type="number" value={form.tax_amount} onChange={e => setForm(f => ({ ...f, tax_amount: e.target.value }))} />
          <Input label="Total" type="number" value={form.total} onChange={e => setForm(f => ({ ...f, total: e.target.value }))} />
          <Select label="Moneda" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}><option>UYU</option><option>USD</option></Select>
          <Btn variant="secondary" size="sm" onClick={() => setEditing(false)}>Cancelar</Btn>
        </div> : <div>
          {fields.map(([label, value, key], i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #f5f5f8" }}>
              <span style={{ fontSize: 12, color: "#8b8b9e" }}>{label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{value}</span>
                {key && inv.confidence[key] != null && <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 4px", borderRadius: 3, background: inv.confidence[key] >= 0.9 ? "#d1fae5" : inv.confidence[key] >= 0.8 ? "#fef3c7" : "#fee2e2", color: inv.confidence[key] >= 0.9 ? "#059669" : inv.confidence[key] >= 0.8 ? "#d97706" : "#dc2626" }}>{Math.round(inv.confidence[key] * 100)}%</span>}
              </div>
            </div>
          ))}
          {sup.bank && sup.bank !== "—" && <div style={{ marginTop: 8, padding: "8px 10px", background: "#f7f7fa", borderRadius: 7, fontSize: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#8b8b9e", marginBottom: 3 }}>BANCO PROVEEDOR</div>
            {sup.bank} · {sup.account_type} · {sup.account_number}
          </div>}
        </div>}
      </Card>
      <DocPreview inv={inv} />
    </div>

    <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
      <Card style={{ flex: 1 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Historial</h3>
        {inv.events.map((e, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: "1px solid #f5f5f8", fontSize: 12 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#e85d04", flexShrink: 0 }}/>
            <span style={{ flex: 1 }}>{e.note} <span style={{ color: "#8b8b9e" }}>— {e.by}</span></span>
            <span style={{ color: "#b0b0c0", fontSize: 11 }}>{fmtDate(e.at)}</span>
          </div>
        ))}
        {inv.events.length === 0 && <div style={{ fontSize: 12, color: "#8b8b9e", textAlign: "center", padding: 8 }}>Sin eventos</div>}
      </Card>
    </div>

    <Btn variant="danger" size="sm" onClick={() => onDelete(inv.id)}>🗑 Eliminar factura</Btn>
  </div>;
}

// ============================================================
// PAYABLES
// ============================================================
function Payables({ invoices, suppliers, recurring, onUpdate, sel, setSel, notify, mobile }) {
  const [showHistory, setShowHistory] = useState(false);
  const payable = invoices.filter(i => ["APPROVED", "SCHEDULED"].includes(i.status)).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
  const paidInvoices = invoices.filter(i => i.status === "PAID").sort((a, b) => new Date(b.payment_date || b.created_at) - new Date(a.payment_date || a.created_at));
  const totalPay = payable.reduce((s, i) => s + i.total, 0);
  const totalPaid = paidInvoices.reduce((s, i) => s + i.total, 0);
  const monthlyFixed = recurring.filter(r => r.active).reduce((s, r) => s + r.amount, 0);
  const selTotal = payable.filter(i => sel.has(i.id)).reduce((s, i) => s + i.total, 0);
  const toggle = id => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Group paid invoices by month
  const paidByMonth = useMemo(() => {
    const groups = {};
    paidInvoices.forEach(inv => {
      const d = inv.payment_date || inv.created_at?.split("T")[0] || "Sin fecha";
      const key = d.slice(0, 7); // YYYY-MM
      if (!groups[key]) groups[key] = { invoices: [], total: 0 };
      groups[key].invoices.push(inv);
      groups[key].total += inv.total;
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [paidInvoices]);

  // ─── Excel Generator ───────────────────────────────────
  const generateExcel = async () => {
    const selected = sel.size > 0 ? payable.filter(i => sel.has(i.id)) : payable;
    if (selected.length === 0) { notify("No hay facturas para exportar", "error"); return; }

    // Load SheetJS dynamically
    if (!window.XLSX) {
      const script = document.createElement("script");
      script.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
      document.head.appendChild(script);
      await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = reject; });
    }
    const XLSX = window.XLSX;

    // Sheet 1: Detalle de facturas
    const detailRows = selected.map(inv => {
      const sup = getSup(suppliers, inv.supplier_id);
      return {
        "Proveedor": sup.name || "—",
        "Alias": sup.alias || "—",
        "RUT": sup.tax_id || "—",
        "N° Factura": inv.invoice_number,
        "Emisión": inv.issue_date || "—",
        "Vencimiento": inv.due_date || "—",
        "Moneda": inv.currency,
        "Subtotal": inv.subtotal,
        "IVA": inv.tax_amount,
        "Total": inv.total,
        "Estado": STATUSES[inv.status]?.label || inv.status,
        "Banco": sup.bank || "—",
        "Cuenta": sup.account_number || "—",
      };
    });

    // Sheet 2: Resumen por proveedor
    const bySupplier = {};
    selected.forEach(inv => {
      const sup = getSup(suppliers, inv.supplier_id);
      const key = sup.name || "Sin proveedor";
      if (!bySupplier[key]) bySupplier[key] = { proveedor: key, alias: sup.alias || "—", rut: sup.tax_id || "—", facturas: 0, total: 0 };
      bySupplier[key].facturas++;
      bySupplier[key].total += inv.total;
    });
    const summaryRows = Object.values(bySupplier).sort((a, b) => b.total - a.total).map(s => ({
      "Proveedor": s.proveedor,
      "Alias": s.alias,
      "RUT": s.rut,
      "Facturas": s.facturas,
      "Total": s.total,
    }));
    // Add total row
    summaryRows.push({ "Proveedor": "TOTAL", "Alias": "", "RUT": "", "Facturas": selected.length, "Total": selected.reduce((s, i) => s + i.total, 0) });

    // Build workbook
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(detailRows);
    const ws2 = XLSX.utils.json_to_sheet(summaryRows);

    // Set column widths
    ws1["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 14 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    ws2["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 14 }, { wch: 10 }, { wch: 14 }];

    XLSX.utils.book_append_sheet(wb, ws1, "Detalle");
    XLSX.utils.book_append_sheet(wb, ws2, "Resumen");

    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
    XLSX.writeFile(wb, `pagos_${today}.xlsx`);
    notify(`📊 Excel generado: ${selected.length} facturas`);
  };
  const generateItauTxt = () => {
    if (sel.size === 0) { notify("Seleccioná facturas", "error"); return; }

    const DEBIT_ACCOUNT = process.env.NEXT_PUBLIC_ITAU_DEBIT_ACCOUNT || "1234567";
    const OFFICE_CODE = process.env.NEXT_PUBLIC_ITAU_OFFICE_CODE || "04";

    const selected = payable.filter(i => sel.has(i.id));
    const errors = [];

    // Build payments array for itau-format.js
    const payments = [];
    selected.forEach(inv => {
      const sup = getSup(suppliers, inv.supplier_id);

      if (!sup.account_number || sup.account_number === "—") {
        errors.push(`${sup.alias || sup.name}: sin cuenta bancaria`);
        return;
      }
      if (!sup.bank || sup.bank === "—") {
        errors.push(`${sup.alias || sup.name}: sin banco asignado`);
        return;
      }
      if (!BANK_CODES[sup.bank]) {
        errors.push(`${sup.alias || sup.name}: banco "${sup.bank}" no reconocido`);
        return;
      }

      payments.push({
        supplier: {
          bank_code: BANK_CODES[sup.bank],
          bank_name: sup.bank,
          account_number: sup.account_number.replace(/\D/g, ""),
          account_type: sup.account_type,
          name: sup.name,
          alias: sup.alias,
        },
        currency: inv.currency || "UYU",
        amount: inv.total,
        payment_date: inv.due_date || inv.issue_date,
        invoice_number: inv.invoice_number || "",
      });
    });

    if (errors.length > 0) {
      notify(`⚠️ ${errors.length} factura(s) sin datos bancarios: ${errors[0]}`, "error");
      if (payments.length === 0) return;
    }

    const { content, filename, summary } = generateItauPaymentFile(payments, DEBIT_ACCOUNT, OFFICE_CODE);

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    notify(`🏦 Archivo Itaú generado: ${summary.total_payments} pago(s) por ${fmt(selTotal)}${summary.other_bank_transfers > 0 ? ` (${summary.other_bank_transfers} inter-bancario)` : ""}`);
  };

  return <div style={{ animation: "fadeIn 0.25s ease" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
      <h1 style={{ fontSize: mobile ? 20 : 22, fontWeight: 800 }}>Pagos</h1>
      <div style={{ display: "flex", gap: 6 }}>
        <Btn variant="secondary" size="sm" onClick={generateExcel}>📊 Excel</Btn>
        <Btn size="sm" onClick={generateItauTxt}>🏦 Itaú</Btn>
      </div>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
      <Card style={{ padding: 12 }}><div style={{ fontSize: 10, color: "#8b8b9e", fontWeight: 600, textTransform: "uppercase" }}>Por Pagar</div><div style={{ fontSize: mobile ? 16 : 20, fontWeight: 800, marginTop: 3 }}>{fmt(totalPay)}</div><div style={{ fontSize: 10, color: "#8b8b9e" }}>{payable.length} facturas</div></Card>
      <Card style={{ padding: 12 }}><div style={{ fontSize: 10, color: "#8b8b9e", fontWeight: 600, textTransform: "uppercase" }}>Fijos Mes</div><div style={{ fontSize: mobile ? 16 : 20, fontWeight: 800, marginTop: 3 }}>{fmt(monthlyFixed)}</div></Card>
      <Card style={{ padding: 12 }}><div style={{ fontSize: 10, color: "#8b8b9e", fontWeight: 600, textTransform: "uppercase" }}>Total Mes</div><div style={{ fontSize: mobile ? 16 : 20, fontWeight: 800, marginTop: 3, color: "#e85d04" }}>{fmt(totalPay + monthlyFixed)}</div></Card>
      <Card style={{ padding: 12, cursor: "pointer", border: showHistory ? "1px solid #059669" : undefined }} onClick={() => setShowHistory(!showHistory)}><div style={{ fontSize: 10, color: "#059669", fontWeight: 600, textTransform: "uppercase" }}>Pagado ✓</div><div style={{ fontSize: mobile ? 16 : 20, fontWeight: 800, marginTop: 3, color: "#059669" }}>{fmt(totalPaid)}</div><div style={{ fontSize: 10, color: "#8b8b9e" }}>{paidInvoices.length} facturas</div></Card>
      {sel.size > 0 && <Card style={{ padding: 12, border: "1px solid #e85d04" }}><div style={{ fontSize: 10, color: "#e85d04", fontWeight: 600, textTransform: "uppercase" }}>Selección</div><div style={{ fontSize: mobile ? 16 : 20, fontWeight: 800, marginTop: 3 }}>{fmt(selTotal)}</div></Card>}
    </div>

    <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
      <Btn variant="secondary" size="sm" onClick={() => setSel(sel.size === payable.length ? new Set() : new Set(payable.map(i => i.id)))}>{sel.size === payable.length ? "Deseleccionar" : "Seleccionar todo"}</Btn>
      {sel.size > 0 && <Btn variant="success" size="sm" onClick={() => { if (!confirm(`¿Marcar ${sel.size} factura(s) como pagadas?`)) return; sel.forEach(id => onUpdate(id, { status: "PAID" })); setSel(new Set()); }}>💰 Pagar {sel.size}</Btn>}
    </div>

    {payable.map(inv => {
      const sup = getSup(suppliers, inv.supplier_id);
      const checked = sel.has(inv.id);
      return <Card key={inv.id} onClick={() => toggle(inv.id)} style={{ padding: "10px 12px", marginBottom: 5, borderLeft: checked ? "3px solid #e85d04" : "3px solid transparent", background: checked ? "#fff8f3" : "#fff", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="checkbox" checked={checked} readOnly style={{ accentColor: "#e85d04", width: 18, height: 18, flexShrink: 0, cursor: "pointer" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{sup.alias}</div>
                <div style={{ fontSize: 11, color: "#8b8b9e" }}>{!mobile && <>{sup.bank} · {sup.account_type} {sup.account_number} · </>}{inv.invoice_number}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{fmt(inv.total, inv.currency)}</div>
                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", marginTop: 2 }}><DueBadge d={inv.due_date} /><Badge status={inv.status} /></div>
              </div>
            </div>
          </div>
        </div>
      </Card>;
    })}
    {payable.length === 0 && !showHistory && <Card style={{ textAlign: "center", padding: 28 }}><div style={{ fontSize: 32, opacity: 0.2 }}>✅</div><div style={{ fontSize: 13, color: "#8b8b9e", marginTop: 4 }}>Sin pagos pendientes</div></Card>}

    {/* ─── Historial de Pagos ─────────────────────────────── */}
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, cursor: "pointer" }} onClick={() => setShowHistory(!showHistory)}>
          {showHistory ? "▾" : "▸"} Historial de Pagos
          <span style={{ fontSize: 12, fontWeight: 500, color: "#8b8b9e", marginLeft: 6 }}>({paidInvoices.length})</span>
        </h2>
        {showHistory && paidInvoices.length > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>Total: {fmt(totalPaid)}</span>}
      </div>

      {showHistory && paidByMonth.map(([month, group]) => {
        const monthLabel = new Date(month + "-15").toLocaleDateString("es-UY", { month: "long", year: "numeric" }).replace(/^\w/, c => c.toUpperCase());
        return <div key={month} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, padding: "4px 0", borderBottom: "2px solid #d1fae5" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>{monthLabel}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#059669" }}>{fmt(group.total)}</span>
          </div>
          {group.invoices.map(inv => {
            const sup = getSup(suppliers, inv.supplier_id);
            return <Card key={inv.id} style={{ padding: "8px 12px", marginBottom: 4, background: "#f9fefb", borderLeft: "3px solid #a7f3d0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{sup.alias || sup.name || "—"}</span>
                    <span style={{ fontSize: 10, color: "#059669", fontWeight: 600, padding: "1px 5px", background: "#d1fae5", borderRadius: 4 }}>💰 Pagada</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 3, fontSize: 11, color: "#8b8b9e" }}>
                    <span>{inv.invoice_number}</span>
                    <span>Emitida: {fmtDate(inv.issue_date)}</span>
                    {inv.payment_date && <span>Pagada: {fmtDate(inv.payment_date)}</span>}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#059669" }}>{fmt(inv.total, inv.currency)}</div>
                  {sup.bank && sup.bank !== "—" && <div style={{ fontSize: 10, color: "#8b8b9e" }}>{sup.bank} · {sup.account_number}</div>}
                </div>
              </div>
            </Card>;
          })}
        </div>;
      })}

      {showHistory && paidInvoices.length === 0 && <Card style={{ textAlign: "center", padding: 20 }}><div style={{ fontSize: 12, color: "#8b8b9e" }}>No hay pagos registrados aún</div></Card>}
    </div>
  </div>;
}

// ============================================================
// RECURRING
// ============================================================
function RecurringView({ recurring, setRecurring, suppliers, onDelete, notify, mobile, categories, updateCategories }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showCatEditor, setShowCatEditor] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [form, setForm] = useState({ type: "fixed_cost", name: "", amount: "", day: "1", supplier_id: "", category: "Servicios", total_installments: "", current_installment: "", card_last4: "" });
  const grouped = useMemo(() => { const g = { fixed_cost: [], owner_withdrawal: [], installment: [] }; recurring.forEach(r => g[r.type]?.push(r)); return g; }, [recurring]);
  const total = recurring.filter(r => r.active).reduce((s, r) => s + r.amount, 0);
  const startEdit = item => { setForm({ type: item.type, name: item.name, amount: String(item.amount), day: String(item.day), supplier_id: item.supplier_id || "", category: item.category, total_installments: item.total_installments ? String(item.total_installments) : "", current_installment: item.current_installment ? String(item.current_installment) : "", card_last4: item.card_last4 || "" }); setEditId(item.id); setShowForm(true); };
  const save = async () => {
    const item = { ...form, amount: Number(form.amount), day: Number(form.day), active: true, variable: false, total_installments: form.total_installments ? Number(form.total_installments) : undefined, current_installment: form.current_installment ? Number(form.current_installment) : undefined };

    // Persist to Supabase
    try {
      const dbRow = {
        name: item.name,
        type: item.type,
        estimated_amount: item.amount,
        day_of_month: item.day,
        category: item.category,
        supplier_id: item.supplier_id || null,
        active: true,
        is_variable: item.variable,
        currency: "UYU",
        frequency: "monthly",
        total_installments: item.total_installments || null,
        current_installment: item.current_installment || null,
        credit_card_last4: item.card_last4 || null,
      };

      if (editId) {
        const { error } = await supabase.from("recurring_expenses").update(dbRow).eq("id", editId);
        if (error) throw error;
        setRecurring(prev => prev.map(r => r.id === editId ? { ...r, ...item } : r));
      } else {
        const { data, error } = await supabase.from("recurring_expenses").insert(dbRow).select().single();
        if (error) throw error;
        setRecurring(prev => [...prev, { ...item, id: data.id }]);
      }
    } catch (err) {
      console.error("Cajú: Error saving recurring", err);
      // Fallback: update local state anyway
      if (editId) {
        setRecurring(prev => prev.map(r => r.id === editId ? { ...r, ...item } : r));
      } else {
        setRecurring(prev => [...prev, { ...item, id: `r${Date.now()}` }]);
      }
    }

    setShowForm(false); setEditId(null);
  };

  return <div style={{ animation: "fadeIn 0.25s ease" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <h1 style={{ fontSize: mobile ? 20 : 22, fontWeight: 800 }}>Fijos & Cuotas</h1>
      <div style={{ display: "flex", gap: 6 }}>
        <Btn variant="secondary" size="sm" onClick={() => setShowCatEditor(!showCatEditor)}>🏷 Categorías</Btn>
        <Btn size={mobile ? "sm" : "md"} onClick={() => { setEditId(null); setForm({ type: "fixed_cost", name: "", amount: "", day: "1", supplier_id: "", category: "Servicios", total_installments: "", current_installment: "", card_last4: "" }); setShowForm(!showForm); }}>+ Nuevo</Btn>
      </div>
    </div>

    {showCatEditor && <Card style={{ marginBottom: 14, border: "1px solid #e0e0e6" }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Editar Categorías</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {categories.map(c => (
          <div key={c} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", background: "#f7f7fa", borderRadius: 6, fontSize: 12, fontWeight: 500 }}>
            {c}
            <button onClick={() => { if (confirm(`¿Eliminar categoría "${c}"?`)) updateCategories(categories.filter(x => x !== c)); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#dc2626", padding: 0, lineHeight: 1 }}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input type="text" value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Nueva categoría..." onKeyDown={e => { if (e.key === "Enter" && newCat.trim()) { updateCategories([...categories, newCat.trim()]); setNewCat(""); } }} style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid #e0e0e6", fontSize: 13, outline: "none" }} />
        <Btn size="sm" onClick={() => { if (newCat.trim()) { updateCategories([...categories, newCat.trim()]); setNewCat(""); } }}>+ Agregar</Btn>
      </div>
    </Card>}

    <Card style={{ marginBottom: 14, background: "linear-gradient(135deg, #1a1a2e, #2d2b55)", color: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div><div style={{ fontSize: 10, color: "#e85d04", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Mensual Total</div><div style={{ fontSize: mobile ? 24 : 28, fontWeight: 800, marginTop: 2 }}>{fmt(total)}</div></div>
        <div style={{ display: "flex", gap: 14 }}>
          {Object.entries(RECURRING_TYPES).map(([k, t]) => <div key={k} style={{ textAlign: "center" }}><div style={{ fontSize: 18 }}>{t.icon}</div><div style={{ fontSize: 9, color: "#a0a0c0", marginTop: 2 }}>{t.label}</div><div style={{ fontSize: 13, fontWeight: 700, marginTop: 1 }}>{fmt(grouped[k]?.reduce((s, r) => s + r.amount, 0) || 0)}</div></div>)}
        </div>
      </div>
    </Card>

    {showForm && <Card style={{ marginBottom: 14, border: "2px solid #e85d04" }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{editId ? "Editar" : "Nuevo"}</h3>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: 8 }}>
        <Select label="Tipo" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}><option value="fixed_cost">Costo Fijo</option><option value="owner_withdrawal">Retiro Socio</option><option value="installment">Cuota Tarjeta</option></Select>
        <Input label="Nombre" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Alquiler" />
        <Input label="Monto" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
        <Input label="Día del mes" type="number" value={form.day} onChange={e => setForm(f => ({ ...f, day: e.target.value }))} />
        <Select label="Categoría" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{[...categories, "Retiro", "Tarjeta"].map(c => <option key={c}>{c}</option>)}</Select>
        <Select label="Proveedor" value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}><option value="">— Ninguno —</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.alias}</option>)}</Select>
        {form.type === "installment" && <>
          <Input label="Total cuotas" type="number" value={form.total_installments} onChange={e => setForm(f => ({ ...f, total_installments: e.target.value }))} />
          <Input label="Cuota actual" type="number" value={form.current_installment} onChange={e => setForm(f => ({ ...f, current_installment: e.target.value }))} />
          <Input label="Tarjeta ****" value={form.card_last4} onChange={e => setForm(f => ({ ...f, card_last4: e.target.value }))} />
        </>}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10, justifyContent: "flex-end" }}><Btn variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancelar</Btn><Btn size="sm" onClick={save} disabled={!form.name.trim() || !form.amount || Number(form.amount) <= 0} style={!form.name.trim() || !form.amount || Number(form.amount) <= 0 ? { opacity: 0.5, cursor: "not-allowed" } : {}}>Guardar</Btn></div>
    </Card>}

    {Object.entries(RECURRING_TYPES).map(([key, type]) => <div key={key} style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}><span style={{ fontSize: 16 }}>{type.icon}</span><h2 style={{ fontSize: 14, fontWeight: 700 }}>{type.label}</h2><span style={{ fontSize: 11, color: "#8b8b9e" }}>— {fmt(grouped[key]?.reduce((s, r) => s + r.amount, 0) || 0)}/mes</span></div>
      {grouped[key]?.map(item => {
        const sup = item.supplier_id ? getSup(suppliers, item.supplier_id) : null;
        return <Card key={item.id} style={{ padding: "11px 14px", marginBottom: 5 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}><span style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</span>{item.variable && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "#fef3c7", color: "#d97706", fontWeight: 600 }}>Variable</span>}</div>
              <div style={{ fontSize: 11, color: "#8b8b9e", marginTop: 2 }}>{sup ? `${sup.alias} · ` : ""}Día {item.day}{item.card_last4 ? ` · ****${item.card_last4}` : ""}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 16, fontWeight: 800, color: type.color }}>{fmt(item.amount)}</div>{item.total_installments && <div style={{ width: 90, marginTop: 2 }}><Progress current={item.current_installment} total={item.total_installments} color={type.color} /></div>}</div>
              <button onClick={() => startEdit(item)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 4 }}>✏️</button>
              <button onClick={() => onDelete(item.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 4 }}>🗑</button>
            </div>
          </div>
        </Card>;
      })}
    </div>)}
  </div>;
}

// ============================================================
// SUPPLIERS
// ============================================================
function Suppliers({ suppliers, setSuppliers, invoices, nav, mobile, onBatchDelete, categories }) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState(new Set());
  const [form, setForm] = useState({ name: "", alias: "", tax_id: "", category: "Insumos", bank: "Itaú", account_type: "CC", account_number: "", currency: "UYU", phone: "", email: "", contact: "", payment_terms: "30 días", notes: "" });
  const filtered = suppliers.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.alias?.toLowerCase().includes(search.toLowerCase()) || s.tax_id?.includes(search));

  const toggleSel = (id, e) => { e.stopPropagation(); setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const toggleAll = () => setSel(sel.size === filtered.length ? new Set() : new Set(filtered.map(s => s.id)));

  const handleBatchDelete = async () => {
    const ok = await onBatchDelete([...sel]);
    if (ok) setSel(new Set());
  };

  const saveSupplier = async () => {
    try {
      const dbRow = {
        name: form.name,
        alias: form.alias,
        tax_id: form.tax_id,
        category: form.category,
        bank_name: form.bank,
        account_type: form.account_type,
        account_number: form.account_number,
        currency: form.currency,
        phone: form.phone,
        email: form.email,
        contact_name: form.contact,
        payment_terms: form.payment_terms,
        notes: form.notes,
      };
      const { data, error } = await supabase.from("suppliers").insert(dbRow).select().single();
      if (error) throw error;
      setSuppliers(p => [...p, { ...form, id: data.id }]);
    } catch (err) {
      console.error("Cajú: Error saving supplier", err);
      setSuppliers(p => [...p, { ...form, id: `s${Date.now()}` }]);
    }
    setShowForm(false);
  };

  return <div style={{ animation: "fadeIn 0.25s ease", overflow: "hidden", maxWidth: "100%" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <h1 style={{ fontSize: mobile ? 20 : 22, fontWeight: 800 }}>Proveedores</h1>
      <Btn size={mobile ? "sm" : "md"} onClick={() => setShowForm(!showForm)}>+ Nuevo</Btn>
    </div>

    {showForm && <Card style={{ marginBottom: 14, border: "2px solid #e85d04", overflow: "hidden" }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Nuevo Proveedor</h3>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: 8, maxWidth: "100%" }}>
        <Input label="Razón Social *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <Input label="Nombre Corto" value={form.alias} onChange={e => setForm(f => ({ ...f, alias: e.target.value }))} />
        <Input label="RUT *" value={form.tax_id} onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} placeholder="21.XXX.XXX.0001" />
        <Select label="Categoría" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{categories.map(c => <option key={c}>{c}</option>)}</Select>
        <Select label="Banco" value={form.bank} onChange={e => setForm(f => ({ ...f, bank: e.target.value }))}>{Object.keys(BANK_CODES).map(b => <option key={b}>{b}</option>)}</Select>
        <Select label="Tipo Cuenta" value={form.account_type} onChange={e => setForm(f => ({ ...f, account_type: e.target.value }))}><option value="CC">Cta Corriente</option><option value="CA">Caja Ahorro</option></Select>
        <Input label="N° Cuenta" value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} />
        <Input label="Teléfono" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
        <Input label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        <Input label="Contacto" value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} />
        <Select label="Cond. Pago" value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))}><option>Contado</option><option>15 días</option><option>30 días</option><option>60 días</option><option>Mensual</option></Select>
        <Input label="Notas" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10, justifyContent: "flex-end" }}><Btn variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancelar</Btn><Btn size="sm" onClick={saveSupplier} disabled={!form.name.trim() || !form.tax_id.trim()} style={!form.name.trim() || !form.tax_id.trim() ? { opacity: 0.5, cursor: "not-allowed" } : {}}>Guardar</Btn></div>
    </Card>}

    <input type="text" placeholder="🔍  Buscar proveedor, RUT..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e0e0e6", fontSize: 14, outline: "none", marginBottom: 10 }} />

    {filtered.length > 0 && <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
      <Btn variant="secondary" size="sm" onClick={toggleAll}>{sel.size === filtered.length ? "Deseleccionar" : `Seleccionar todo (${filtered.length})`}</Btn>
      {sel.size > 0 && <>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#e85d04" }}>{sel.size} seleccionado(s)</span>
        <Btn variant="danger" size="sm" onClick={handleBatchDelete}>🗑 Eliminar</Btn>
      </>}
    </div>}

    <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 8 }}>
      {filtered.map(sup => {
        const pending = invoices.filter(i => i.supplier_id === sup.id && !["PAID", "REJECTED"].includes(i.status)).reduce((s, i) => s + i.total, 0);
        const checked = sel.has(sup.id);
        return <Card key={sup.id} hover onClick={() => nav("suppliers", sup.id)} style={{ borderLeft: checked ? "3px solid #e85d04" : "3px solid transparent", background: checked ? "#fff8f3" : "#fff", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <input type="checkbox" checked={checked} onChange={() => {}} onClick={(e) => { e.stopPropagation(); setSel(p => { const n = new Set(p); n.has(sup.id) ? n.delete(sup.id) : n.add(sup.id); return n; }); }} style={{ accentColor: "#e85d04", width: 16, height: 16, flexShrink: 0, marginTop: 2, cursor: "pointer" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flex: 1, minWidth: 0, gap: 8 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sup.name}</div>
                <div style={{ fontSize: 11, color: "#8b8b9e", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sup.alias} · {sup.tax_id}</div>
                <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 3, background: "#f7f7fa", color: "#6b7280" }}>{sup.category}</span>
                  {sup.bank && sup.bank !== "—" && <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 3, background: "#fff3e8", color: "#e85d04" }}>🏦 {sup.bank}</span>}
                </div>
              </div>
              {pending > 0 && <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}><div style={{ fontSize: 9, color: "#8b8b9e" }}>Pendiente</div><div style={{ fontSize: 14, fontWeight: 800, color: "#e85d04" }}>{fmt(pending)}</div></div>}
            </div>
          </div>
        </Card>;
      })}
    </div>
  </div>;
}

// ============================================================
// SUPPLIER DETAIL
// ============================================================
function SupDetail({ sup, invs, suppliers, setSuppliers, onBack, onDelete, notify, mobile, categories }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...sup });

  const save = async () => {
    try {
      const dbRow = {
        name: form.name,
        alias: form.alias,
        tax_id: form.tax_id,
        phone: form.phone,
        email: form.email,
        contact_name: form.contact,
        bank_name: form.bank,
        account_type: form.account_type,
        account_number: form.account_number,
        category: form.category,
        payment_terms: form.payment_terms,
        notes: form.notes,
      };
      const { error } = await supabase.from("suppliers").update(dbRow).eq("id", sup.id);
      if (error) throw error;
    } catch (err) {
      console.error("Cajú: Error updating supplier", err);
    }
    setSuppliers(p => p.map(s => s.id === sup.id ? { ...s, ...form } : s));
    setEditing(false);
  };

  const pending = invs.filter(i => !["PAID", "REJECTED"].includes(i.status)).reduce((s, i) => s + i.total, 0);
  const paid = invs.filter(i => i.status === "PAID").reduce((s, i) => s + i.total, 0);

  return <div style={{ animation: "fadeIn 0.25s ease" }}>
    <Btn variant="ghost" onClick={onBack} size="sm" style={{ marginBottom: 10 }}>← Volver</Btn>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
      <div><h1 style={{ fontSize: mobile ? 18 : 20, fontWeight: 800 }}>{sup.name}</h1><div style={{ fontSize: 12, color: "#8b8b9e", marginTop: 2 }}>{sup.alias} · {sup.tax_id}</div></div>
      <Btn variant="secondary" size="sm" onClick={() => { setForm({ ...sup }); setEditing(!editing); }}>✏️ Editar</Btn>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 14 }}>
      <Card>
        <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Datos</h3>
        {editing ? <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Input label="Razón Social" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Input label="Nombre Corto" value={form.alias} onChange={e => setForm(f => ({ ...f, alias: e.target.value }))} />
          <Input label="RUT" value={form.tax_id} onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} />
          <Select label="Categoría" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{categories.map(c => <option key={c}>{c}</option>)}</Select>
          <Input label="Teléfono" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          <Input label="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <Input label="Contacto" value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} />
          <Select label="Cond. Pago" value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))}><option>Contado</option><option>15 días</option><option>30 días</option><option>60 días</option><option>Mensual</option></Select>
          <Input label="Notas" value={form.notes || ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}><Btn variant="secondary" size="sm" onClick={() => setEditing(false)}>Cancelar</Btn><Btn size="sm" onClick={save}>Guardar</Btn></div>
        </div> : <div>
          {[["Razón Social", sup.name], ["Alias", sup.alias], ["RUT", sup.tax_id], ["Categoría", sup.category], ["Teléfono", sup.phone], ["Email", sup.email], ["Contacto", sup.contact], ["Pago", sup.payment_terms], ["Notas", sup.notes || "—"]].map(([l, v], i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #f5f5f8", fontSize: 12 }}>
              <span style={{ color: "#8b8b9e" }}>{l}</span><span style={{ fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>}
      </Card>

      <Card>
        <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Banco</h3>
        {editing ? <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Select label="Banco" value={form.bank || ""} onChange={e => setForm(f => ({ ...f, bank: e.target.value }))}><option value="">— Seleccionar —</option>{Object.keys(BANK_CODES).map(b => <option key={b}>{b}</option>)}</Select>
          <Select label="Tipo Cuenta" value={form.account_type || ""} onChange={e => setForm(f => ({ ...f, account_type: e.target.value }))}><option value="">—</option><option value="CC">Cta Corriente</option><option value="CA">Caja Ahorro</option></Select>
          <Input label="N° Cuenta" value={form.account_number || ""} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} />
          <Select label="Moneda" value={form.currency || "UYU"} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}><option>UYU</option><option>USD</option></Select>
          {form.bank && <div style={{ marginTop: 4, padding: "6px 10px", background: "#f7f7fa", borderRadius: 6, fontSize: 11, color: "#8b8b9e" }}>Cód. Itaú: <strong>{BANK_CODES[form.bank] || "—"}</strong></div>}
        </div> : <>
          {[["Banco", sup.bank], ["Tipo", sup.account_type === "CC" ? "Cta Corriente" : sup.account_type === "CA" ? "Caja Ahorro" : sup.account_type], ["N° Cuenta", sup.account_number], ["Moneda", sup.currency], ["Cód Itaú", BANK_CODES[sup.bank] || "—"]].map(([l, v], i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #f5f5f8", fontSize: 12 }}>
              <span style={{ color: "#8b8b9e" }}>{l}</span><span style={{ fontWeight: 500 }}>{v || "—"}</span>
            </div>
          ))}
          {(!sup.bank || sup.bank === "—" || !sup.account_number || sup.account_number === "—") && <div style={{ marginTop: 8, padding: "8px 10px", background: "#fef2f2", borderRadius: 7, fontSize: 11, color: "#dc2626", fontWeight: 500, textAlign: "center" }}>⚠️ Completá los datos bancarios para generar pagos Itaú</div>}
        </>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10 }}>
          <div style={{ padding: "8px 10px", background: "#fff3e8", borderRadius: 7, textAlign: "center" }}><div style={{ fontSize: 10, color: "#e85d04", fontWeight: 600 }}>Pendiente</div><div style={{ fontSize: 15, fontWeight: 800, color: "#e85d04" }}>{fmt(pending)}</div></div>
          <div style={{ padding: "8px 10px", background: "#ecfdf5", borderRadius: 7, textAlign: "center" }}><div style={{ fontSize: 10, color: "#059669", fontWeight: 600 }}>Pagado</div><div style={{ fontSize: 15, fontWeight: 800, color: "#059669" }}>{fmt(paid)}</div></div>
        </div>
      </Card>
    </div>

    <Card>
      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Facturas ({invs.length})</h3>
      {invs.map(inv => <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #f5f5f8" }}>
        <div><span style={{ fontSize: 12 }}>{inv.invoice_number}</span><span style={{ fontSize: 11, color: "#8b8b9e", marginLeft: 6 }}>{fmtDate(inv.issue_date)}</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 13, fontWeight: 700 }}>{fmt(inv.total, inv.currency)}</span><Badge status={inv.status} /></div>
      </div>)}
      {invs.length === 0 && <div style={{ fontSize: 12, color: "#8b8b9e", textAlign: "center", padding: 12 }}>Sin facturas</div>}
    </Card>

    <div style={{ marginTop: 14 }}><Btn variant="danger" size="sm" onClick={() => onDelete(sup.id)}>🗑 Eliminar proveedor</Btn></div>
  </div>;
}
