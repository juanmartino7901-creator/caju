export const fmt = (n, c = "UYU") => n == null ? "—" : `${c === "USD" ? "US$" : "$"} ${Number(n).toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export const fmtDate = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("es-UY", { day: "2-digit", month: "short" }) : "—";

export const fmtDateFull = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const daysUntil = (d) => { if (!d) return null; const t = new Date(); t.setHours(0,0,0,0); return Math.ceil((new Date(d+"T12:00:00").setHours(0,0,0,0) - t) / 864e5); };

export const STATUSES = {
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

export const BANK_CODES = {
  "Itaú": "113", "BROU": "1", "Santander": "137",
  "Scotiabank": "128", "BBVA": "153", "HSBC": "157",
  "Bandes": "110", "Citibank": "205", "Nación Argentina": "246",
};
