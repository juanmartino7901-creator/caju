"use client";
import { useState } from "react";
import { STATUSES, daysUntil } from "@/lib/utils";

export const PAGE_SIZE = 25;

export const Badge = ({ status, size = "sm" }) => {
  const s = STATUSES[status] || STATUSES.NEW;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: size === "sm" ? "2px 7px" : "3px 10px", borderRadius: 6, fontSize: size === "sm" ? 10 : 12, fontWeight: 600, color: s.color, backgroundColor: s.bg, border: `1px solid ${s.color}22`, whiteSpace: "nowrap" }}>
    <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: s.color }}/>{s.label}
  </span>;
};

export const DueBadge = ({ d }) => {
  const days = daysUntil(d); if (days === null) return null;
  let color, bg, text;
  if (days < 0) { color = "#dc2626"; bg = "#fef2f2"; text = `${Math.abs(days)}d atrás`; }
  else if (days === 0) { color = "#dc2626"; bg = "#fef2f2"; text = "Hoy"; }
  else if (days <= 3) { color = "#f59e0b"; bg = "#fffbeb"; text = `${days}d`; }
  else if (days <= 7) { color = "#3b82f6"; bg = "#eff6ff"; text = `${days}d`; }
  else { color = "#6b7280"; bg = "#f9fafb"; text = `${days}d`; }
  return <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 5px", borderRadius: 4, color, backgroundColor: bg, whiteSpace: "nowrap" }}>{text}</span>;
};

export const Card = ({ children, style, onClick, hover, ...p }) => {
  const [h, setH] = useState(false);
  return <div onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8ec", padding: 16, transition: "all 0.15s", cursor: onClick ? "pointer" : "default", boxShadow: h && hover ? "0 4px 16px rgba(0,0,0,0.06)" : "0 1px 2px rgba(0,0,0,0.02)", ...style }} {...p}>{children}</div>;
};

export const Btn = ({ children, variant = "primary", size = "md", ...p }) => {
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

export const Input = ({ label, ...p }) => <div style={{ width: "100%" }}>
  {label && <label style={{ fontSize: 11, fontWeight: 600, color: "#8b8b9e", display: "block", marginBottom: 3 }}>{label}</label>}
  <input {...p} style={{ width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid #e0e0e6", fontSize: 14, outline: "none", WebkitAppearance: "none", ...p.style }} />
</div>;

export const Select = ({ label, children, ...p }) => <div style={{ width: "100%" }}>
  {label && <label style={{ fontSize: 11, fontWeight: 600, color: "#8b8b9e", display: "block", marginBottom: 3 }}>{label}</label>}
  <select {...p} style={{ width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid #e0e0e6", fontSize: 14, outline: "none", background: "#fff", ...p.style }}>{children}</select>
</div>;

export const Progress = ({ current, total, color = "#e85d04" }) => <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
  <div style={{ flex: 1, height: 5, background: "#f1f1f5", borderRadius: 3, overflow: "hidden" }}>
    <div style={{ width: `${Math.round((current / total) * 100)}%`, height: "100%", background: color, borderRadius: 3 }}/>
  </div>
  <span style={{ fontSize: 10, color: "#8b8b9e", fontWeight: 600 }}>{current}/{total}</span>
</div>;

export const Pagination = ({ page, setPage, totalItems, label }) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const start = totalItems === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, totalItems);
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", fontSize: 12, color: "#8b8b9e" }}>
    <span style={{ fontWeight: 500 }}>Mostrando {start}-{end} de {totalItems}{label ? ` ${label}` : ""}</span>
    {totalPages > 1 && <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #e0e0e6", background: page <= 1 ? "#f5f5f8" : "#fff", color: page <= 1 ? "#ccc" : "#1a1a2e", fontSize: 12, fontWeight: 600, cursor: page <= 1 ? "default" : "pointer" }}>← Anterior</button>
      <span style={{ fontWeight: 600, color: "#1a1a2e", padding: "0 6px" }}>{page} / {totalPages}</span>
      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #e0e0e6", background: page >= totalPages ? "#f5f5f8" : "#fff", color: page >= totalPages ? "#ccc" : "#1a1a2e", fontSize: 12, fontWeight: 600, cursor: page >= totalPages ? "default" : "pointer" }}>Siguiente →</button>
    </div>}
  </div>;
};

// Confidence badge with tooltip
export const ConfBadge = ({ value }) => {
  const [showTip, setShowTip] = useState(false);
  if (value == null) return null;
  const pct = Math.round(value * 100);
  const color = value >= 0.9 ? "#059669" : value >= 0.8 ? "#d97706" : "#dc2626";
  const bg = value >= 0.9 ? "#d1fae5" : value >= 0.8 ? "#fef3c7" : "#fee2e2";
  const icon = value >= 0.9 ? "✓" : value >= 0.8 ? "⚠" : "✗";
  return <span
    onMouseEnter={() => setShowTip(true)} onMouseLeave={() => setShowTip(false)}
    style={{ position: "relative", fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 3, background: bg, color, cursor: "help", display: "inline-flex", alignItems: "center", gap: 2 }}
  >
    {icon} {pct}%
    {showTip && <span style={{ position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 4, padding: "4px 8px", borderRadius: 4, background: "#1a1a2e", color: "#fff", fontSize: 10, fontWeight: 500, whiteSpace: "nowrap", zIndex: 10 }}>Confianza: {pct}%</span>}
  </span>;
};

// Extraction checklist summary
export const ExtractionChecklist = ({ inv, sup }) => {
  const checks = [
    { label: "Proveedor", ok: !!(sup.name && sup.name !== "— Sin asignar —"), conf: inv.confidence?.emisor_nombre || inv.confidence?.supplier_name },
    { label: "Monto", ok: inv.total > 0, conf: inv.confidence?.total },
    { label: "Fecha", ok: !!inv.issue_date, conf: inv.confidence?.issue_date },
    { label: "Vto", ok: !!inv.due_date, conf: inv.confidence?.due_date },
    { label: "RUT", ok: !!(sup.tax_id && sup.tax_id !== "—"), conf: inv.confidence?.emisor_rut || inv.confidence?.tax_id },
    { label: "N° Factura", ok: inv.invoice_number && inv.invoice_number !== "—", conf: inv.confidence?.invoice_number },
  ];
  return <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
    {checks.map((c, i) => {
      const status = !c.ok ? "miss" : c.conf != null && c.conf < 0.8 ? "warn" : "ok";
      const color = status === "ok" ? "#059669" : status === "warn" ? "#d97706" : "#dc2626";
      const bg = status === "ok" ? "#d1fae5" : status === "warn" ? "#fef3c7" : "#fee2e2";
      const icon = status === "ok" ? "✓" : status === "warn" ? "⚠" : "✗";
      return <span key={i} style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4, color, background: bg, whiteSpace: "nowrap" }}>{c.label} {icon}</span>;
    })}
  </div>;
};
