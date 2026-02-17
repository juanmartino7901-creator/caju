export const fmt = (n, cur = "UYU") => {
  if (n == null) return "—";
  const s = cur === "USD" ? "US$" : "$";
  return `${s} ${Number(n).toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

export const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" });
};

export const daysUntil = (d) => {
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(d + "T12:00:00");
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due - today) / (1000 * 60 * 60 * 24));
};

export const STATUSES = {
  NEW: { label: "Nueva", color: "#7c3aed" },
  EXTRACTING: { label: "Procesando", color: "#d97706" },
  EXTRACTED: { label: "Extraída", color: "#2563eb" },
  REVIEW_REQUIRED: { label: "Revisión", color: "#ea580c" },
  APPROVED: { label: "Aprobada", color: "#059669" },
  SCHEDULED: { label: "Programada", color: "#7c3aed" },
  PAID: { label: "Pagada", color: "#047857" },
  DISPUTE: { label: "Disputa", color: "#dc2626" },
  REJECTED: { label: "Rechazada", color: "#6b7280" },
  DUPLICATE: { label: "Duplicada", color: "#9ca3af" },
};

export const BANK_CODES = {
  "Itaú": "113", "BROU": "1", "Santander": "137",
  "Scotiabank": "128", "BBVA": "153", "HSBC": "157",
  "Bandes": "110", "Citibank": "205",
};
