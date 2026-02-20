"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

// ============================================================
// CAJÚ — Complete MVP — Mobile Responsive — Supabase Connected
// ============================================================

// ─── Supabase Client ─────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const BANK_CODES = { "Itaú": "113", "BROU": "1", "Santander": "137", "Scotiabank": "128", "BBVA": "153", "HSBC": "157", "Bandes": "110", "Citibank": "205" };

const STATUSES = {
  NEW: { label: "Nueva", color: "#6366f1", bg: "#eef2ff", icon: "📥" },
  EXTRACTING: { label: "Procesando", color: "#f59e0b", bg: "#fffbeb", icon: "⚙️" },
  EXTRACTED: { label: "Extraída", color: "#3b82f6", bg: "#eff6ff", icon: "✓" },
  REVIEW_REQUIRED: { label: "Revisión", color: "#f97316", bg: "#fff7ed", icon: "👁" },
  APPROVED: { label: "Aprobada", color: "#10b981", bg: "#ecfdf5", icon: "✅" },
  SCHEDULED: { label: "Programada", color: "#8b5cf6", bg: "#f5f3ff", icon: "📅" },
  PAID: { label: "Pagada", color: "#059669", bg: "#d1fae5", icon: "💰" },
  DISPUTE: { label: "Disputa", color: "#ef4444", bg: "#fef2f2", icon: "⚡" },
  REJECTED: { label: "Rechazada", color: "#6b7280", bg: "#f3f4f6", icon: "✕" },
  DUPLICATE: { label: "Duplicada", color: "#9ca3af", bg: "#f9fafb", icon: "📋" },
};

const RECURRING_TYPES = {
  fixed_cost: { label: "Costo Fijo", icon: "📋", color: "#6366f1" },
  owner_withdrawal: { label: "Retiro Socio", icon: "👤", color: "#8b5cf6" },
  installment: { label: "Cuota Tarjeta", icon: "💳", color: "#f59e0b" },
};

const CATEGORIES = ["Insumos", "Carnes", "Panificados", "Packaging", "Logística", "Servicios", "Alquiler", "Seguros", "Impuestos", "Suscripciones"];

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
const fmt = (n, c = "UYU") => n == null ? "—" : `${c === "USD" ? "US$" : "$"} ${Number(n).toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtDate = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("es-UY", { day: "2-digit", month: "short" }) : "—";
const fmtDateFull = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const daysUntil = (d) => { if (!d) return null; const t = new Date(); t.setHours(0,0,0,0); return Math.ceil((new Date(d+"T12:00:00").setHours(0,0,0,0) - t) / 864e5); };
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

  // ─── Auth ────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
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
  const notify = useCallback((msg, type = "success") => { setNotification({ msg, type }); setTimeout(() => setNotification(null), 2500); }, []);
  const nav = useCallback((v, id = null) => { setView(v); setSelectedId(id); }, []);

  // ─── Update invoice: write to Supabase then update local state ───
  const updateInvoice = useCallback(async (id, updates) => {
    // Optimistic update
    setInvoices(prev => prev.map(inv => inv.id === id ? {
      ...inv, ...updates,
      events: [...inv.events, { type: "change", by: "Juan", at: new Date().toISOString().split("T")[0], note: `→ ${STATUSES[updates.status]?.label}` }]
    } : inv));
    notify(`Factura → ${STATUSES[updates.status]?.label}`);

    // Persist to Supabase
    try {
      const { error: updErr } = await supabase
        .from("invoices")
        .update({ status: updates.status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (updErr) throw updErr;

      // Log event
      await supabase.from("invoice_events").insert({
        invoice_id: id,
        event_type: "status_change",
        notes: `→ ${STATUSES[updates.status]?.label} por Juan`,
      });
    } catch (err) {
      console.error("Cajú: Error updating invoice", err);
      notify("Error al guardar cambio", "error");
    }
  }, [notify]);

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
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</div><div style={{ fontSize: 9, color: "#e85d04" }}>Admin</div></div>
      <button onClick={signOut} title="Cerrar sesión" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#8b8b9e", padding: 4 }}>⏻</button>
    </div>
  </nav>;

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", background: "#f7f7fa", color: "#1a1a2e" }}>
      {!mobile && <Sidebar />}

      <main style={{ flex: 1, overflow: "auto", padding: mobile ? "12px 12px 72px" : 22 }}>
        {mobile && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "4px 0" }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}><span style={{ color: "#e85d04" }}>Caj</span>ú</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={signOut} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#8b8b9e", fontWeight: 600 }}>Salir</button>
            {userAvatar ? <img src={userAvatar} alt="" style={{ width: 28, height: 28, borderRadius: 7 }} referrerPolicy="no-referrer" /> : <div style={{ width: 28, height: 28, borderRadius: 7, background: "#e85d04", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>{userInitial}</div>}
          </div>
        </div>}

        {notification && <div style={{ position: "fixed", top: mobile ? 8 : 14, right: mobile ? 8 : 14, left: mobile ? 8 : "auto", zIndex: 999, padding: "10px 16px", borderRadius: 10, background: notification.type === "success" ? "#059669" : "#ef4444", color: "#fff", fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", textAlign: "center" }}>{notification.msg}</div>}

        {view === "dashboard" && <Dashboard stats={stats} invoices={invoices} recurring={recurring} suppliers={suppliers} nav={nav} mobile={mobile} />}
        {view === "inbox" && !selInv && <Inbox invoices={invoices} suppliers={suppliers} filters={filters} setFilters={setFilters} nav={nav} notify={notify} mobile={mobile} onInvoiceUploaded={fetchData} />}
        {view === "inbox" && selInv && <InvDetail inv={selInv} sup={getSup(suppliers, selInv.supplier_id)} onBack={() => nav("inbox")} onUpdate={updateInvoice} mobile={mobile} />}
        {view === "payables" && <Payables invoices={invoices} suppliers={suppliers} recurring={recurring} onUpdate={updateInvoice} sel={paySelection} setSel={setPaySelection} notify={notify} mobile={mobile} />}
        {view === "recurring" && <RecurringView recurring={recurring} setRecurring={setRecurring} suppliers={suppliers} mobile={mobile} />}
        {view === "suppliers" && !selSup && <Suppliers suppliers={suppliers} setSuppliers={setSuppliers} invoices={invoices} nav={nav} mobile={mobile} />}
        {view === "suppliers" && selSup && <SupDetail sup={selSup} invs={invoices.filter(i => i.supplier_id === selSup.id)} suppliers={suppliers} setSuppliers={setSuppliers} onBack={() => nav("suppliers")} mobile={mobile} />}
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
      <p style={{ fontSize: 12, color: "#8b8b9e", marginTop: 2 }}>Febrero 2026</p>
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
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 13, fontWeight: 700 }}>{fmt(inv.total)}</span><DueBadge d={inv.due_date} /></div>
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
function Inbox({ invoices, suppliers, filters, setFilters, nav, notify, mobile, onInvoiceUploaded }) {
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const filtered = useMemo(() => {
    let list = invoices;
    if (filters.status !== "ALL") list = list.filter(i => i.status === filters.status);
    if (filters.search) { const t = filters.search.toLowerCase(); list = list.filter(i => { const s = getSup(suppliers, i.supplier_id); return s.name?.toLowerCase().includes(t) || s.alias?.toLowerCase().includes(t) || i.invoice_number.toLowerCase().includes(t); }); }
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [invoices, filters, suppliers]);

  const handleUpload = async (file) => {
    if (!file) return;
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) { notify("Formato no soportado. Usá PDF, JPG o PNG.", "error"); return; }
    if (file.size > 10 * 1024 * 1024) { notify("Archivo demasiado grande (máx 10MB)", "error"); return; }

    setUploading(true);
    setUploadProgress("Subiendo archivo...");
    try {
      const formData = new FormData();
      formData.append("file", file);

      setUploadProgress("Extrayendo datos con AI...");
      const res = await fetch("/api/invoices", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) { notify("Esta factura ya fue subida", "error"); }
        else { notify(data.error || "Error subiendo factura", "error"); }
        return;
      }

      setShowUpload(false);
      notify(data.supplier_matched
        ? `✅ Factura extraída — ${data.extracted.emisor_nombre}`
        : data.supplier_created
        ? `✅ Factura extraída — Proveedor "${data.extracted.emisor_nombre}" creado automáticamente`
        : `✅ Factura extraída — Revisá los datos del proveedor`
      );

      if (onInvoiceUploaded) onInvoiceUploaded();
    } catch (err) {
      console.error("Upload error:", err);
      notify("Error de conexión al subir factura", "error");
    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  };

  const onFileSelect = (e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); e.target.value = ""; };
  const onDrop = (e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.[0]) handleUpload(e.dataTransfer.files[0]); };

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
        <div style={{ fontSize: 11, color: "#8b8b9e", marginTop: 3 }}>PDF, JPG, PNG — Máx 10 MB</div>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 12, padding: "8px 16px", borderRadius: 8, background: "#e85d04", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          📁 Elegir archivo
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={onFileSelect} style={{ display: "none" }} />
        </label>
      </>}
    </Card>}

    <input type="text" placeholder="🔍  Buscar proveedor, número..." value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e0e0e6", fontSize: 14, outline: "none", marginBottom: 8 }} />

    <div style={{ display: "flex", gap: 5, marginBottom: 10, overflowX: "auto", paddingBottom: 4 }}>
      {["ALL", "NEW", "REVIEW_REQUIRED", "EXTRACTED", "APPROVED", "SCHEDULED", "PAID"].map(st => (
        <button key={st} onClick={() => setFilters(f => ({ ...f, status: st }))} style={{ padding: "5px 9px", borderRadius: 6, border: "1px solid #e0e0e6", background: filters.status === st ? "#e85d04" : "#fff", color: filters.status === st ? "#fff" : "#6b7280", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
          {st === "ALL" ? "Todas" : STATUSES[st]?.label}
        </button>
      ))}
    </div>

    {filtered.map(inv => {
      const sup = getSup(suppliers, inv.supplier_id);
      return <Card key={inv.id} hover onClick={() => nav("inbox", inv.id)} style={{ padding: mobile ? "12px 14px" : "10px 14px", marginBottom: 5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sup.alias || sup.name}</span>
              <Badge status={inv.status} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#8b8b9e" }}>{inv.invoice_number}</span>
              <span style={{ fontSize: 11, color: "#b0b0c0" }}>{fmtDate(inv.issue_date)}</span>
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{fmt(inv.total)}</div>
            <DueBadge d={inv.due_date} />
          </div>
        </div>
      </Card>;
    })}
    {filtered.length === 0 && <Card style={{ textAlign: "center", padding: 28 }}><div style={{ fontSize: 32, opacity: 0.2 }}>📭</div><div style={{ fontSize: 13, color: "#8b8b9e", marginTop: 4 }}>Sin facturas</div></Card>}
  </div>;
}

// ============================================================
// INVOICE DETAIL
// ============================================================
function InvDetail({ inv, sup, onBack, onUpdate, mobile }) {
  const actions = [];
  if (["EXTRACTED", "REVIEW_REQUIRED"].includes(inv.status)) {
    actions.push({ label: "Aprobar", status: "APPROVED", variant: "success", icon: "✅" });
    actions.push({ label: "Disputa", status: "DISPUTE", variant: "danger", icon: "⚡" });
    actions.push({ label: "Rechazar", status: "REJECTED", variant: "danger", icon: "✕" });
  }
  if (inv.status === "APPROVED") actions.push({ label: "Programar", status: "SCHEDULED", variant: "primary", icon: "📅" });
  if (["APPROVED", "SCHEDULED"].includes(inv.status)) actions.push({ label: "Pagada", status: "PAID", variant: "success", icon: "💰" });
  if (inv.status === "DISPUTE") { actions.push({ label: "Aprobar", status: "APPROVED", variant: "success", icon: "✅" }); actions.push({ label: "Rechazar", status: "REJECTED", variant: "danger", icon: "✕" }); }

  const fields = [
    ["Proveedor", sup.name, "supplier_name"], ["RUT", sup.tax_id, "tax_id"], ["N° Factura", inv.invoice_number, "invoice_number"],
    ["Emisión", fmtDateFull(inv.issue_date), "issue_date"], ["Vencimiento", fmtDateFull(inv.due_date), "due_date"],
    ["Subtotal", fmt(inv.subtotal)], ["IVA", fmt(inv.tax_amount), "tax_amount"], ["Total", fmt(inv.total), "total"],
  ];

  return <div style={{ animation: "fadeIn 0.25s ease" }}>
    <Btn variant="ghost" onClick={onBack} size="sm" style={{ marginBottom: 10 }}>← Volver</Btn>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
      <div>
        <h1 style={{ fontSize: mobile ? 18 : 20, fontWeight: 800 }}>{sup.alias || sup.name}</h1>
        <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#6b7280" }}>{inv.invoice_number}</span>
          <Badge status={inv.status} size="md" />
          <span style={{ fontSize: 10, color: "#8b8b9e", background: "#f7f7fa", padding: "2px 6px", borderRadius: 4 }}>📥 {inv.source}</span>
        </div>
      </div>
      <div style={{ textAlign: "right" }}><div style={{ fontSize: mobile ? 22 : 26, fontWeight: 800 }}>{fmt(inv.total)}</div><DueBadge d={inv.due_date} /></div>
    </div>

    {actions.length > 0 && <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
      {actions.map((a, i) => <Btn key={i} variant={a.variant} size={mobile ? "lg" : "md"} onClick={() => onUpdate(inv.id, { status: a.status })} style={{ flex: mobile ? "1 1 auto" : undefined }}>{a.icon} {a.label}</Btn>)}
    </div>}

    <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 14 }}>
      <Card>
        <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Datos Extraídos</h3>
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
      </Card>
      <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#fafafa", minHeight: 160 }}>
        <div style={{ fontSize: 40, opacity: 0.2, marginBottom: 4 }}>📄</div>
        <div style={{ fontSize: 12, color: "#8b8b9e" }}>Preview documento</div>
      </Card>
    </div>

    <Card>
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
  </div>;
}

// ============================================================
// PAYABLES
// ============================================================
function Payables({ invoices, suppliers, recurring, onUpdate, sel, setSel, notify, mobile }) {
  const payable = invoices.filter(i => ["APPROVED", "SCHEDULED"].includes(i.status)).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
  const totalPay = payable.reduce((s, i) => s + i.total, 0);
  const monthlyFixed = recurring.filter(r => r.active).reduce((s, r) => s + r.amount, 0);
  const selTotal = payable.filter(i => sel.has(i.id)).reduce((s, i) => s + i.total, 0);
  const toggle = id => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ─── Itaú TXT Generator (Diseño Clásico - Pago Proveedores) ───
  const generateItauTxt = () => {
    if (sel.size === 0) { notify("Seleccioná facturas", "error"); return; }

    const MONTHS = { 0: "JAN", 1: "FEB", 2: "MAR", 3: "APR", 4: "MAY", 5: "JUN", 6: "JUL", 7: "AUG", 8: "SEP", 9: "OCT", 10: "NOV", 11: "DEC" };
    const DEBIT_ACCOUNT = "1234567"; // Will be overridden by env if available
    const OFFICE_CODE = "04";

    const fmtItauDate = (dateStr) => {
      const d = dateStr ? new Date(dateStr + "T12:00:00") : new Date();
      const dd = String(d.getDate()).padStart(2, "0");
      const mmm = MONTHS[d.getMonth()];
      const yy = String(d.getFullYear()).slice(-2);
      return dd + mmm + yy;
    };

    const fmtItauMonto = (amount) => {
      const cents = Math.round(amount * 100);
      return String(cents).padStart(15, "0");
    };

    const sanitize = (str) => (str || "").replace(/[ñÑ]/g, "#").replace(/[áÁ]/g, "a").replace(/[éÉ]/g, "e").replace(/[íÍ]/g, "i").replace(/[óÓ]/g, "o").replace(/[úÚüÜ]/g, "u").replace(/[^a-zA-Z0-9\/\?\:\(\)\.\,\'\+\s\-]/g, "");

    const selected = payable.filter(i => sel.has(i.id));
    const lines = [];
    let errors = [];

    selected.forEach(inv => {
      const sup = getSup(suppliers, inv.supplier_id);

      // Validate supplier has bank account
      if (!sup.account_number || sup.account_number === "—") {
        errors.push(`${sup.alias || sup.name}: sin cuenta bancaria`);
        return;
      }
      if (!sup.bank || sup.bank === "—") {
        errors.push(`${sup.alias || sup.name}: sin banco asignado`);
        return;
      }

      const bankCode = BANK_CODES[sup.bank];
      if (!bankCode) {
        errors.push(`${sup.alias || sup.name}: banco "${sup.bank}" no reconocido`);
        return;
      }

      // Build 97-position record (Diseño Clásico Pago Proveedores)
      const acctDebit = DEBIT_ACCOUNT.padStart(7, "0");           // Pos 1-7: Cuenta a debitar
      const aplicativo = "7777";                                    // Pos 8-11: Aplicativo pago proveedores
      const tipoPago = "2";                                         // Pos 12: Tipo de pago (2 = Acreditación en Cuenta)
      const filler1 = "       ";                                    // Pos 13-19: Filler 7 espacios
      const referencia = sanitize(inv.invoice_number).padEnd(12).slice(0, 12); // Pos 20-31: Referencia
      const filler2 = "                            ";               // Pos 32-59: Filler 28 espacios
      const acctCredit = sup.account_number.replace(/\D/g, "").padStart(7, "0"); // Pos 60-66: Cuenta a acreditar
      const moneda = inv.currency === "USD" ? "US.D" : "URGP";    // Pos 67-70: Moneda
      const monto = fmtItauMonto(inv.total);                       // Pos 71-85: Monto
      const fecha = fmtItauDate(inv.due_date || inv.issue_date);  // Pos 86-92: Fecha
      const oficina = OFFICE_CODE.padStart(2, "0");                // Pos 93-94: Oficina
      const destino = "PAP";                                        // Pos 95-97: Destino de fondos

      const line = acctDebit + aplicativo + tipoPago + filler1 + referencia + filler2 + acctCredit + moneda + monto + fecha + oficina + destino;
      lines.push(line);
    });

    if (errors.length > 0) {
      notify(`⚠️ ${errors.length} factura(s) sin datos bancarios: ${errors[0]}`, "error");
      if (lines.length === 0) return;
    }

    // Download the file
    const content = lines.join("\r\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
    a.href = url;
    a.download = `pago_proveedores_${today}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    notify(`🏦 Archivo Itaú generado: ${lines.length} pago(s) por ${fmt(selTotal)}`);
  };

  return <div style={{ animation: "fadeIn 0.25s ease" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
      <h1 style={{ fontSize: mobile ? 20 : 22, fontWeight: 800 }}>Pagos</h1>
      <div style={{ display: "flex", gap: 6 }}>
        <Btn variant="secondary" size="sm" onClick={() => sel.size > 0 ? notify(`Excel: ${sel.size} pagos`) : notify("Seleccioná facturas", "error")}>📊 Excel</Btn>
        <Btn size="sm" onClick={generateItauTxt}>🏦 Itaú</Btn>
      </div>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
      <Card style={{ padding: 12 }}><div style={{ fontSize: 10, color: "#8b8b9e", fontWeight: 600, textTransform: "uppercase" }}>Facturas</div><div style={{ fontSize: mobile ? 16 : 20, fontWeight: 800, marginTop: 3 }}>{fmt(totalPay)}</div></Card>
      <Card style={{ padding: 12 }}><div style={{ fontSize: 10, color: "#8b8b9e", fontWeight: 600, textTransform: "uppercase" }}>Fijos Mes</div><div style={{ fontSize: mobile ? 16 : 20, fontWeight: 800, marginTop: 3 }}>{fmt(monthlyFixed)}</div></Card>
      <Card style={{ padding: 12 }}><div style={{ fontSize: 10, color: "#8b8b9e", fontWeight: 600, textTransform: "uppercase" }}>Total</div><div style={{ fontSize: mobile ? 16 : 20, fontWeight: 800, marginTop: 3, color: "#e85d04" }}>{fmt(totalPay + monthlyFixed)}</div></Card>
      {sel.size > 0 && <Card style={{ padding: 12, border: "1px solid #e85d04" }}><div style={{ fontSize: 10, color: "#e85d04", fontWeight: 600, textTransform: "uppercase" }}>Selección</div><div style={{ fontSize: mobile ? 16 : 20, fontWeight: 800, marginTop: 3 }}>{fmt(selTotal)}</div></Card>}
    </div>

    <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
      <Btn variant="secondary" size="sm" onClick={() => setSel(sel.size === payable.length ? new Set() : new Set(payable.map(i => i.id)))}>{sel.size === payable.length ? "Deseleccionar" : "Seleccionar todo"}</Btn>
      {sel.size > 0 && <Btn variant="success" size="sm" onClick={() => { sel.forEach(id => onUpdate(id, { status: "PAID" })); setSel(new Set()); }}>💰 Pagar {sel.size}</Btn>}
    </div>

    {payable.map(inv => {
      const sup = getSup(suppliers, inv.supplier_id);
      const checked = sel.has(inv.id);
      return <Card key={inv.id} style={{ padding: "10px 12px", marginBottom: 5, borderLeft: checked ? "3px solid #e85d04" : "3px solid transparent", background: checked ? "#fff8f3" : "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="checkbox" checked={checked} onChange={() => toggle(inv.id)} style={{ accentColor: "#e85d04", width: 18, height: 18, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{sup.alias}</div>
                <div style={{ fontSize: 11, color: "#8b8b9e" }}>{!mobile && <>{sup.bank} · {sup.account_type} {sup.account_number} · </>}{inv.invoice_number}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{fmt(inv.total)}</div>
                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", marginTop: 2 }}><DueBadge d={inv.due_date} /><Badge status={inv.status} /></div>
              </div>
            </div>
          </div>
        </div>
      </Card>;
    })}
    {payable.length === 0 && <Card style={{ textAlign: "center", padding: 28 }}><div style={{ fontSize: 32, opacity: 0.2 }}>✅</div><div style={{ fontSize: 13, color: "#8b8b9e", marginTop: 4 }}>Sin pagos pendientes</div></Card>}
  </div>;
}

// ============================================================
// RECURRING
// ============================================================
function RecurringView({ recurring, setRecurring, suppliers, mobile }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
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
      <Btn size={mobile ? "sm" : "md"} onClick={() => { setEditId(null); setForm({ type: "fixed_cost", name: "", amount: "", day: "1", supplier_id: "", category: "Servicios", total_installments: "", current_installment: "", card_last4: "" }); setShowForm(!showForm); }}>+ Nuevo</Btn>
    </div>

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
        <Select label="Categoría" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{[...CATEGORIES, "Retiro", "Tarjeta"].map(c => <option key={c}>{c}</option>)}</Select>
        <Select label="Proveedor" value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}><option value="">— Ninguno —</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.alias}</option>)}</Select>
        {form.type === "installment" && <>
          <Input label="Total cuotas" type="number" value={form.total_installments} onChange={e => setForm(f => ({ ...f, total_installments: e.target.value }))} />
          <Input label="Cuota actual" type="number" value={form.current_installment} onChange={e => setForm(f => ({ ...f, current_installment: e.target.value }))} />
          <Input label="Tarjeta ****" value={form.card_last4} onChange={e => setForm(f => ({ ...f, card_last4: e.target.value }))} />
        </>}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10, justifyContent: "flex-end" }}><Btn variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancelar</Btn><Btn size="sm" onClick={save}>Guardar</Btn></div>
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
function Suppliers({ suppliers, setSuppliers, invoices, nav, mobile }) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", alias: "", tax_id: "", category: "Insumos", bank: "Itaú", account_type: "CC", account_number: "", currency: "UYU", phone: "", email: "", contact: "", payment_terms: "30 días", notes: "" });
  const filtered = suppliers.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.alias?.toLowerCase().includes(search.toLowerCase()) || s.tax_id?.includes(search));

  const saveSupplier = async () => {
    try {
      const dbRow = {
        name: form.name,
        alias: form.alias,
        tax_id: form.tax_id,
        rut: form.tax_id,
        category: form.category,
        bank_name: form.bank,
        bank: form.bank,
        account_type: form.account_type,
        account_number: form.account_number,
        currency: form.currency,
        phone: form.phone,
        email: form.email,
        contact_name: form.contact,
        contact: form.contact,
        payment_terms: form.payment_terms,
        notes: form.notes,
      };
      const { data, error } = await supabase.from("suppliers").insert(dbRow).select().single();
      if (error) throw error;
      setSuppliers(p => [...p, { ...form, id: data.id }]);
    } catch (err) {
      console.error("Cajú: Error saving supplier", err);
      // Fallback local
      setSuppliers(p => [...p, { ...form, id: `s${Date.now()}` }]);
    }
    setShowForm(false);
  };

  return <div style={{ animation: "fadeIn 0.25s ease" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <h1 style={{ fontSize: mobile ? 20 : 22, fontWeight: 800 }}>Proveedores</h1>
      <Btn size={mobile ? "sm" : "md"} onClick={() => setShowForm(!showForm)}>+ Nuevo</Btn>
    </div>

    {showForm && <Card style={{ marginBottom: 14, border: "2px solid #e85d04" }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Nuevo Proveedor</h3>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: 8 }}>
        <Input label="Razón Social *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <Input label="Nombre Corto" value={form.alias} onChange={e => setForm(f => ({ ...f, alias: e.target.value }))} />
        <Input label="RUT *" value={form.tax_id} onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} placeholder="21.XXX.XXX.0001" />
        <Select label="Categoría" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</Select>
        <Select label="Banco" value={form.bank} onChange={e => setForm(f => ({ ...f, bank: e.target.value }))}>{Object.keys(BANK_CODES).map(b => <option key={b}>{b}</option>)}</Select>
        <Select label="Tipo Cuenta" value={form.account_type} onChange={e => setForm(f => ({ ...f, account_type: e.target.value }))}><option value="CC">Cta Corriente</option><option value="CA">Caja Ahorro</option></Select>
        <Input label="N° Cuenta" value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} />
        <Input label="Teléfono" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
        <Input label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        <Input label="Contacto" value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} />
        <Select label="Cond. Pago" value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))}><option>Contado</option><option>15 días</option><option>30 días</option><option>60 días</option><option>Mensual</option></Select>
        <Input label="Notas" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10, justifyContent: "flex-end" }}><Btn variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancelar</Btn><Btn size="sm" onClick={saveSupplier}>Guardar</Btn></div>
    </Card>}

    <input type="text" placeholder="🔍  Buscar proveedor, RUT..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e0e0e6", fontSize: 14, outline: "none", marginBottom: 10 }} />

    <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 8 }}>
      {filtered.map(sup => {
        const pending = invoices.filter(i => i.supplier_id === sup.id && !["PAID", "REJECTED"].includes(i.status)).reduce((s, i) => s + i.total, 0);
        return <Card key={sup.id} hover onClick={() => nav("suppliers", sup.id)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sup.name}</div>
              <div style={{ fontSize: 11, color: "#8b8b9e", marginTop: 2 }}>{sup.alias} · {sup.tax_id}</div>
              <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
                <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 3, background: "#f7f7fa", color: "#6b7280" }}>{sup.category}</span>
                {sup.bank && sup.bank !== "—" && <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 3, background: "#fff3e8", color: "#e85d04" }}>🏦 {sup.bank}</span>}
              </div>
            </div>
            {pending > 0 && <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}><div style={{ fontSize: 9, color: "#8b8b9e" }}>Pendiente</div><div style={{ fontSize: 14, fontWeight: 800, color: "#e85d04" }}>{fmt(pending)}</div></div>}
          </div>
        </Card>;
      })}
    </div>
  </div>;
}

// ============================================================
// SUPPLIER DETAIL
// ============================================================
function SupDetail({ sup, invs, suppliers, setSuppliers, onBack, mobile }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...sup });

  const save = async () => {
    // Persist to Supabase
    try {
      const dbRow = {
        name: form.name,
        alias: form.alias,
        tax_id: form.tax_id,
        rut: form.tax_id,
        phone: form.phone,
        email: form.email,
        contact_name: form.contact,
        contact: form.contact,
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
      <Btn variant="secondary" size="sm" onClick={() => setEditing(!editing)}>✏️ Editar</Btn>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 14 }}>
      <Card>
        <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Datos</h3>
        {editing ? <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Input label="Razón Social" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Input label="Nombre Corto" value={form.alias} onChange={e => setForm(f => ({ ...f, alias: e.target.value }))} />
          <Input label="RUT" value={form.tax_id} onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} />
          <Input label="Teléfono" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          <Input label="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <Input label="Contacto" value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} />
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
        {[["Banco", sup.bank], ["Tipo", sup.account_type === "CC" ? "Cta Corriente" : sup.account_type === "CA" ? "Caja Ahorro" : sup.account_type], ["N° Cuenta", sup.account_number], ["Moneda", sup.currency], ["Cód Itaú", BANK_CODES[sup.bank] || "—"]].map(([l, v], i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #f5f5f8", fontSize: 12 }}>
            <span style={{ color: "#8b8b9e" }}>{l}</span><span style={{ fontWeight: 500 }}>{v}</span>
          </div>
        ))}
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
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 13, fontWeight: 700 }}>{fmt(inv.total)}</span><Badge status={inv.status} /></div>
      </div>)}
      {invs.length === 0 && <div style={{ fontSize: 12, color: "#8b8b9e", textAlign: "center", padding: 12 }}>Sin facturas</div>}
    </Card>
  </div>;
}
