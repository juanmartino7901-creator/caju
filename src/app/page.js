"use client";
import { useState, useEffect, useCallback, useMemo } from "react";

// ============================================================
// CAJÚ — Complete MVP — Mobile Responsive
// ============================================================

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

// ============================================================
// INITIAL DATA
// ============================================================
function initSuppliers() {
  return [
    { id: "s1", name: "Distribuidora del Este S.A.", alias: "Dist. Este", tax_id: "21.234.567.0001", category: "Insumos", bank: "Itaú", account_type: "CC", account_number: "1234567", currency: "UYU", phone: "2604 5678", email: "ventas@disteste.com.uy", contact: "María López", payment_terms: "30 días", notes: "" },
    { id: "s2", name: "Frigorífico Nacional S.A.", alias: "Frigo Nacional", tax_id: "21.098.765.0001", category: "Carnes", bank: "BROU", account_type: "CA", account_number: "9876543210", currency: "UYU", phone: "2908 1234", email: "pagos@frigonal.com.uy", contact: "Carlos Pérez", payment_terms: "15 días", notes: "Descuento 2% contado" },
    { id: "s3", name: "Panadería La Rica", alias: "Pan La Rica", tax_id: "21.555.333.0001", category: "Panificados", bank: "Itaú", account_type: "CC", account_number: "7654321", currency: "UYU", phone: "099 123 456", email: "larica@gmail.com", contact: "Roberto Silva", payment_terms: "Contado", notes: "" },
    { id: "s4", name: "Envases Uruguay S.A.", alias: "Envases UY", tax_id: "21.777.888.0001", category: "Packaging", bank: "Santander", account_type: "CC", account_number: "456789012345", currency: "UYU", phone: "2707 9988", email: "compras@envaseuy.com.uy", contact: "Ana García", payment_terms: "30 días", notes: "" },
    { id: "s5", name: "Transporte Rápido SRL", alias: "Transp Rápido", tax_id: "21.444.222.0001", category: "Logística", bank: "Itaú", account_type: "CA", account_number: "3456789", currency: "UYU", phone: "099 876 543", email: "admin@transporterapido.uy", contact: "Diego Martínez", payment_terms: "15 días", notes: "" },
    { id: "s6", name: "Limpieza Total S.A.", alias: "Limp Total", tax_id: "21.666.999.0001", category: "Servicios", bank: "BROU", account_type: "CC", account_number: "1122334455", currency: "UYU", phone: "2901 4455", email: "contacto@limpiezatotal.uy", contact: "Laura Fernández", payment_terms: "Contado", notes: "" },
    { id: "s7", name: "Inmobiliaria Punta", alias: "Inmob Punta", tax_id: "21.321.654.0001", category: "Alquiler", bank: "Itaú", account_type: "CC", account_number: "9988776", currency: "UYU", phone: "2710 3344", email: "cobros@inmobpunta.com.uy", contact: "Fabiana Rodríguez", payment_terms: "Mensual", notes: "Contrato hasta Dic 2027" },
    { id: "s8", name: "UTE", alias: "UTE", tax_id: "21.100.100.0001", category: "Servicios", bank: "BROU", account_type: "—", account_number: "—", currency: "UYU", phone: "0800 1930", email: "—", contact: "—", payment_terms: "Mensual", notes: "Pago por Abitab/Red Pagos" },
    { id: "s9", name: "OSE", alias: "OSE", tax_id: "21.200.200.0001", category: "Servicios", bank: "BROU", account_type: "—", account_number: "—", currency: "UYU", phone: "0800 1871", email: "—", contact: "—", payment_terms: "Mensual", notes: "" },
    { id: "s10", name: "BSE", alias: "BSE Seguros", tax_id: "21.300.300.0001", category: "Seguros", bank: "BROU", account_type: "CC", account_number: "5566778899", currency: "UYU", phone: "1998", email: "—", contact: "—", payment_terms: "Mensual", notes: "Póliza incendio + robo" },
  ];
}

function initInvoices() {
  const data = [
    { sid: "s1", num: "FA-001234", series: "A", issue: "2026-01-28", due: "2026-02-27", total: 45200, source: "email" },
    { sid: "s2", num: "FA-005678", series: "B", issue: "2026-02-05", due: "2026-02-20", total: 128500, source: "paper" },
    { sid: "s3", num: "FA-000891", series: "A", issue: "2026-02-10", due: "2026-02-18", total: 18700, source: "whatsapp" },
    { sid: "s4", num: "FA-002345", series: "E", issue: "2026-02-01", due: "2026-02-28", total: 32100, source: "email" },
    { sid: "s5", num: "FA-003456", series: "A", issue: "2026-02-08", due: "2026-02-28", total: 22800, source: "paper" },
    { sid: "s6", num: "FA-004567", series: "A", issue: "2026-02-12", due: "2026-02-20", total: 8900, source: "email" },
    { sid: "s1", num: "FA-001300", series: "A", issue: "2026-02-14", due: "2026-03-16", total: 38500, source: "email" },
    { sid: "s2", num: "FA-005700", series: "B", issue: "2026-02-13", due: "2026-02-28", total: 96200, source: "paper" },
    { sid: "s4", num: "FA-002400", series: "E", issue: "2026-02-15", due: "2026-03-15", total: 27800, source: "email" },
    { sid: "s3", num: "FA-000920", series: "A", issue: "2026-02-16", due: "2026-02-16", total: 12400, source: "whatsapp" },
  ];
  const statuses = ["APPROVED", "EXTRACTED", "REVIEW_REQUIRED", "APPROVED", "SCHEDULED", "EXTRACTED", "NEW", "NEW", "APPROVED", "REVIEW_REQUIRED"];
  return data.map((d, i) => {
    const tax = Math.round(d.total * 0.22 / 1.22);
    return {
      id: `inv-${String(i + 1).padStart(3, "0")}`, supplier_id: d.sid, invoice_number: d.num, series: d.series,
      issue_date: d.issue, due_date: d.due, currency: "UYU", subtotal: d.total - tax, tax_amount: tax, total: d.total,
      status: statuses[i], source: d.source,
      confidence: { supplier_name: 0.95, tax_id: 0.92, invoice_number: 0.98, issue_date: 0.97, total: 0.99, due_date: i === 2 ? 0.72 : 0.88, currency: 1.0, tax_amount: 0.90 },
      created_at: d.issue + "T10:00:00", payment_date: null,
      events: [
        { type: "created", by: i < 5 ? "Empleado" : "Sistema", at: d.issue, note: `Subida desde ${d.source}` },
        { type: "extracted", by: "AI (Claude)", at: d.issue, note: "Extracción completada" },
      ],
    };
  });
}

function initRecurring() {
  return [
    { id: "r1", type: "fixed_cost", name: "Alquiler Local", amount: 85000, currency: "UYU", frequency: "monthly", day: 5, category: "Alquiler", active: true, supplier_id: "s7", variable: false },
    { id: "r2", type: "fixed_cost", name: "UTE (Electricidad)", amount: 18000, currency: "UYU", frequency: "monthly", day: 15, category: "Servicios", active: true, supplier_id: "s8", variable: true },
    { id: "r3", type: "fixed_cost", name: "OSE (Agua)", amount: 4500, currency: "UYU", frequency: "monthly", day: 20, category: "Servicios", active: true, supplier_id: "s9", variable: true },
    { id: "r4", type: "fixed_cost", name: "IMM (Tributo)", amount: 3200, currency: "UYU", frequency: "monthly", day: 10, category: "Impuestos", active: true, supplier_id: null, variable: false },
    { id: "r5", type: "fixed_cost", name: "Seguro Local", amount: 12000, currency: "UYU", frequency: "monthly", day: 1, category: "Seguros", active: true, supplier_id: "s10", variable: false },
    { id: "r6", type: "fixed_cost", name: "Antel Internet+Tel", amount: 3500, currency: "UYU", frequency: "monthly", day: 12, category: "Servicios", active: true, supplier_id: null, variable: false },
    { id: "r7", type: "fixed_cost", name: "Software POS", amount: 2500, currency: "UYU", frequency: "monthly", day: 1, category: "Suscripciones", active: true, supplier_id: null, variable: false },
    { id: "r8", type: "owner_withdrawal", name: "Retiro Juan", amount: 120000, currency: "UYU", frequency: "monthly", day: 25, category: "Retiro", active: true, supplier_id: null, variable: false },
    { id: "r9", type: "installment", name: "Horno Industrial", amount: 15000, currency: "UYU", frequency: "monthly", day: 8, category: "Tarjeta", active: true, supplier_id: null, variable: false, total_installments: 12, current_installment: 5, card_last4: "4521" },
    { id: "r10", type: "installment", name: "Cámara Frigorífica", amount: 22000, currency: "UYU", frequency: "monthly", day: 8, category: "Tarjeta", active: true, supplier_id: null, variable: false, total_installments: 18, current_installment: 3, card_last4: "4521" },
    { id: "r11", type: "installment", name: "Mostrador Exhibidor", amount: 8500, currency: "UYU", frequency: "monthly", day: 8, category: "Tarjeta", active: true, supplier_id: null, variable: false, total_installments: 6, current_installment: 4, card_last4: "7832" },
  ];
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
// MAIN APP
// ============================================================
export default function Home() {
  const mobile = useIsMobile();
  const [view, setView] = useState("dashboard");
  const [selectedId, setSelectedId] = useState(null);
  const [invoices, setInvoices] = useState(initInvoices);
  const [suppliers, setSuppliers] = useState(initSuppliers);
  const [recurring, setRecurring] = useState(initRecurring);
  const [filters, setFilters] = useState({ status: "ALL", search: "" });
  const [notification, setNotification] = useState(null);
  const [paySelection, setPaySelection] = useState(new Set());

  const notify = useCallback((msg, type = "success") => { setNotification({ msg, type }); setTimeout(() => setNotification(null), 2500); }, []);
  const nav = useCallback((v, id = null) => { setView(v); setSelectedId(id); }, []);

  const updateInvoice = useCallback((id, updates) => {
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...updates, events: [...inv.events, { type: "change", by: "Juan", at: new Date().toISOString().split("T")[0], note: `→ ${STATUSES[updates.status]?.label}` }] } : inv));
    notify(`Factura → ${STATUSES[updates.status]?.label}`);
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
      <div style={{ width: 28, height: 28, borderRadius: 7, background: "#e85d04", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>J</div>
      <div><div style={{ fontSize: 12, fontWeight: 600 }}>Juan</div><div style={{ fontSize: 9, color: "#e85d04" }}>Admin</div></div>
    </div>
  </nav>;

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", background: "#f7f7fa", color: "#1a1a2e" }}>
      {!mobile && <Sidebar />}

      <main style={{ flex: 1, overflow: "auto", padding: mobile ? "12px 12px 72px" : 22 }}>
        {mobile && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "4px 0" }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}><span style={{ color: "#e85d04" }}>Caj</span>ú</div>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "#e85d04", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>J</div>
        </div>}

        {notification && <div style={{ position: "fixed", top: mobile ? 8 : 14, right: mobile ? 8 : 14, left: mobile ? 8 : "auto", zIndex: 999, padding: "10px 16px", borderRadius: 10, background: notification.type === "success" ? "#059669" : "#ef4444", color: "#fff", fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", textAlign: "center" }}>{notification.msg}</div>}

        {view === "dashboard" && <Dashboard stats={stats} invoices={invoices} recurring={recurring} suppliers={suppliers} nav={nav} mobile={mobile} />}
        {view === "inbox" && !selInv && <Inbox invoices={invoices} suppliers={suppliers} filters={filters} setFilters={setFilters} nav={nav} notify={notify} mobile={mobile} />}
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
function Inbox({ invoices, suppliers, filters, setFilters, nav, notify, mobile }) {
  const [showUpload, setShowUpload] = useState(false);
  const filtered = useMemo(() => {
    let list = invoices;
    if (filters.status !== "ALL") list = list.filter(i => i.status === filters.status);
    if (filters.search) { const t = filters.search.toLowerCase(); list = list.filter(i => { const s = getSup(suppliers, i.supplier_id); return s.name?.toLowerCase().includes(t) || s.alias?.toLowerCase().includes(t) || i.invoice_number.toLowerCase().includes(t); }); }
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [invoices, filters, suppliers]);

  return <div style={{ animation: "fadeIn 0.25s ease" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <h1 style={{ fontSize: mobile ? 20 : 22, fontWeight: 800 }}>Inbox</h1>
      <Btn size={mobile ? "sm" : "md"} onClick={() => setShowUpload(!showUpload)}>📤 Subir</Btn>
    </div>

    {showUpload && <Card style={{ marginBottom: 12, border: "2px dashed #e85d04", background: "#fff8f3", textAlign: "center", padding: 24 }}>
      <div style={{ fontSize: 32, marginBottom: 4, opacity: 0.3 }}>📄</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#e85d04" }}>Arrastrá archivos o tocá para seleccionar</div>
      <div style={{ fontSize: 11, color: "#8b8b9e", marginTop: 3 }}>PDF, JPG, PNG — Máx 10 MB</div>
      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 12 }}>
        {[["📸", "Papel"], ["📧", "Email"], ["💬", "WhatsApp"]].map(([ic, lb]) => (
          <Btn key={lb} variant="secondary" size="sm" onClick={() => { setShowUpload(false); notify(`Subida desde ${lb} (demo)`); }}>{ic} {lb}</Btn>
        ))}
      </div>
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

  return <div style={{ animation: "fadeIn 0.25s ease" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
      <h1 style={{ fontSize: mobile ? 20 : 22, fontWeight: 800 }}>Pagos</h1>
      <div style={{ display: "flex", gap: 6 }}>
        <Btn variant="secondary" size="sm" onClick={() => sel.size > 0 ? notify(`Excel: ${sel.size} pagos`) : notify("Seleccioná facturas", "error")}>📊 Excel</Btn>
        <Btn size="sm" onClick={() => sel.size > 0 ? notify(`Archivo Itaú: ${sel.size} pagos por ${fmt(selTotal)}`) : notify("Seleccioná facturas", "error")}>🏦 Itaú</Btn>
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
  const save = () => {
    const item = { ...form, amount: Number(form.amount), day: Number(form.day), active: true, variable: false, total_installments: form.total_installments ? Number(form.total_installments) : undefined, current_installment: form.current_installment ? Number(form.current_installment) : undefined };
    setRecurring(prev => editId ? prev.map(r => r.id === editId ? { ...r, ...item } : r) : [...prev, { ...item, id: `r${Date.now()}` }]);
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
      <div style={{ display: "flex", gap: 6, marginTop: 10, justifyContent: "flex-end" }}><Btn variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancelar</Btn><Btn size="sm" onClick={() => { setSuppliers(p => [...p, { ...form, id: `s${Date.now()}` }]); setShowForm(false); }}>Guardar</Btn></div>
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
  const save = () => { setSuppliers(p => p.map(s => s.id === sup.id ? { ...s, ...form } : s)); setEditing(false); };
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
