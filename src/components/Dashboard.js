"use client";
import { useMemo } from "react";
import { fmt, fmtDate as fmtDateShort, daysUntil, STATUSES } from "@/lib/utils";
import { Card, Badge, DueBadge } from "@/components/SharedUI";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const fmtDate = fmtDateShort;
const getSup = (suppliers, id) => suppliers.find(s => s.id === id) || {};

// Get last N months as YYYY-MM keys
function getLastMonths(n) {
  const months = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 7));
  }
  return months;
}

function monthLabel(ym) {
  const d = new Date(ym + "-15");
  return d.toLocaleDateString("es-UY", { month: "short" }).replace(/^\w/, c => c.toUpperCase()).replace(".", "");
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return <div style={{ background: "#1a1a2e", color: "#fff", padding: "8px 12px", borderRadius: 8, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
    <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
    {payload.map((p, i) => (
      <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <span style={{ color: p.color }}>{p.name}</span>
        <span style={{ fontWeight: 600 }}>{fmt(p.value)}</span>
      </div>
    ))}
  </div>;
};

export default function Dashboard({ stats, invoices, recurring, suppliers, nav, mobile }) {
  const byType = useMemo(() => {
    const r = { fixed: 0, withdrawal: 0, installment: 0 };
    recurring.filter(x => x.active).forEach(x => { if (x.type === "fixed_cost") r.fixed += x.amount; else if (x.type === "owner_withdrawal") r.withdrawal += x.amount; else r.installment += x.amount; });
    return r;
  }, [recurring]);

  // ─── Monthly spending chart (last 6 months) ────────────
  const monthlyData = useMemo(() => {
    const months = getLastMonths(6);
    const paid = invoices.filter(i => i.status === "PAID");
    return months.map(ym => {
      const monthInvoices = paid.filter(i => {
        const d = i.payment_date || i.created_at?.split("T")[0];
        return d && d.startsWith(ym);
      });
      const uyu = monthInvoices.filter(i => i.currency !== "USD").reduce((s, i) => s + i.total, 0);
      const usd = monthInvoices.filter(i => i.currency === "USD").reduce((s, i) => s + i.total, 0);
      return { name: monthLabel(ym), UYU: Math.round(uyu), USD: Math.round(usd), total: Math.round(uyu + usd), count: monthInvoices.length };
    });
  }, [invoices]);

  const hasUSD = monthlyData.some(m => m.USD > 0);

  // ─── Month vs month comparison ─────────────────────────
  const comparison = useMemo(() => {
    const months = getLastMonths(2);
    const paid = invoices.filter(i => i.status === "PAID");
    const getMonthTotal = (ym) => paid.filter(i => {
      const d = i.payment_date || i.created_at?.split("T")[0];
      return d && d.startsWith(ym);
    }).reduce((s, i) => s + i.total, 0);

    const current = getMonthTotal(months[1]);
    const previous = getMonthTotal(months[0]);
    const pctChange = previous > 0 ? Math.round(((current - previous) / previous) * 100) : current > 0 ? 100 : 0;
    return { current, previous, pctChange, currentLabel: monthLabel(months[1]), previousLabel: monthLabel(months[0]) };
  }, [invoices]);

  // ─── Top 5 suppliers by paid amount ────────────────────
  const topSuppliers = useMemo(() => {
    const paid = invoices.filter(i => i.status === "PAID");
    const bySupplier = {};
    paid.forEach(inv => {
      const sup = getSup(suppliers, inv.supplier_id);
      const key = inv.supplier_id || "unknown";
      if (!bySupplier[key]) bySupplier[key] = { name: sup.alias || sup.name || "Sin proveedor", total: 0, count: 0 };
      bySupplier[key].total += inv.total;
      bySupplier[key].count++;
    });
    return Object.values(bySupplier).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [invoices, suppliers]);

  // ─── Currency breakdown ────────────────────────────────
  const currencyBreakdown = useMemo(() => {
    const paid = invoices.filter(i => i.status === "PAID");
    const uyu = paid.filter(i => i.currency !== "USD").reduce((s, i) => s + i.total, 0);
    const usd = paid.filter(i => i.currency === "USD").reduce((s, i) => s + i.total, 0);
    return { uyu, usd, total: uyu + usd, uyuPct: uyu + usd > 0 ? Math.round((uyu / (uyu + usd)) * 100) : 100 };
  }, [invoices]);

  return <div style={{ animation: "fadeIn 0.25s ease" }}>
    <div style={{ marginBottom: 14 }}>
      <h1 style={{ fontSize: mobile ? 20 : 22, fontWeight: 800 }}>Dashboard</h1>
      <p style={{ fontSize: 12, color: "#8b8b9e", marginTop: 2 }}>{new Date().toLocaleDateString("es-UY", { month: "long", year: "numeric" }).replace(/^\w/, c => c.toUpperCase())}</p>
    </div>

    {/* ─── KPI Cards ────────────────────────────────────── */}
    <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
      <Card style={{ padding: 14 }}><div style={{ fontSize: 10, color: "#8b8b9e", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Pendiente</div><div style={{ fontSize: mobile ? 18 : 22, fontWeight: 800, marginTop: 4 }}>{fmt(stats.totalPending)}</div><div style={{ fontSize: 10, color: "#8b8b9e", marginTop: 2 }}>{stats.pending.length} facturas</div></Card>
      <Card style={{ padding: 14 }}><div style={{ fontSize: 10, color: "#8b8b9e", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Vencidas</div><div style={{ fontSize: mobile ? 18 : 22, fontWeight: 800, marginTop: 4, color: stats.overdue.length > 0 ? "#dc2626" : "#059669" }}>{stats.overdue.length}</div><div style={{ fontSize: 10, color: "#8b8b9e", marginTop: 2 }}>{stats.overdue.length > 0 ? "⚠️ Atención" : "✅ Al día"}</div></Card>
      <Card style={{ padding: 14 }}><div style={{ fontSize: 10, color: "#8b8b9e", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Vence 7d</div><div style={{ fontSize: mobile ? 18 : 22, fontWeight: 800, marginTop: 4 }}>{stats.due7.length}</div><div style={{ fontSize: 10, color: "#8b8b9e", marginTop: 2 }}>{fmt(stats.due7.reduce((s, i) => s + i.total, 0))}</div></Card>
      <Card style={{ padding: 14 }}>
        <div style={{ fontSize: 10, color: "#8b8b9e", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Mes vs Anterior</div>
        <div style={{ fontSize: mobile ? 18 : 22, fontWeight: 800, marginTop: 4, color: comparison.pctChange > 0 ? "#dc2626" : comparison.pctChange < 0 ? "#059669" : "#8b8b9e" }}>
          {comparison.pctChange > 0 ? "+" : ""}{comparison.pctChange}%
        </div>
        <div style={{ fontSize: 10, color: "#8b8b9e", marginTop: 2 }}>{comparison.currentLabel} vs {comparison.previousLabel}</div>
      </Card>
    </div>

    {/* ─── Monthly Spending Chart ──────────────────────── */}
    <Card style={{ marginBottom: 14 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Gastos por Mes (últimos 6 meses)</h3>
      <div style={{ width: "100%", height: mobile ? 200 : 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthlyData} margin={{ top: 5, right: 5, bottom: 5, left: mobile ? -15 : 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f4" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8b8b9e" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#8b8b9e" }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : v} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="UYU" fill="#e85d04" radius={[4, 4, 0, 0]} name="UYU" />
            {hasUSD && <Bar dataKey="USD" fill="#3b82f6" radius={[4, 4, 0, 0]} name="USD" />}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 8, justifyContent: "center" }}>
        <span style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#e85d04", display: "inline-block" }} /> UYU</span>
        {hasUSD && <span style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#3b82f6", display: "inline-block" }} /> USD</span>}
      </div>
    </Card>

    <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 14 }}>
      {/* ─── Top 5 Suppliers ────────────────────────────── */}
      <Card>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Top 5 Proveedores (pagado)</h3>
        {topSuppliers.length === 0 && <div style={{ fontSize: 12, color: "#8b8b9e", textAlign: "center", padding: 12 }}>Sin pagos registrados</div>}
        {topSuppliers.map((s, i) => {
          const maxTotal = topSuppliers[0]?.total || 1;
          const pct = Math.round((s.total / maxTotal) * 100);
          return <div key={i} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
              <span style={{ fontSize: 12, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i + 1}. {s.name}</span>
              <span style={{ fontSize: 12, fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>{fmt(s.total)}</span>
            </div>
            <div style={{ height: 6, background: "#f1f1f5", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: i === 0 ? "#e85d04" : i === 1 ? "#f59e0b" : "#d1d5db", borderRadius: 3, transition: "width 0.3s" }} />
            </div>
            <div style={{ fontSize: 10, color: "#8b8b9e", marginTop: 1 }}>{s.count} factura{s.count !== 1 ? "s" : ""}</div>
          </div>;
        })}
      </Card>

      {/* ─── Breakdown by Currency + Monthly Obligations ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Currency breakdown */}
        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Pagado por Moneda</h3>
          {currencyBreakdown.total === 0 ? (
            <div style={{ fontSize: 12, color: "#8b8b9e", textAlign: "center", padding: 12 }}>Sin pagos registrados</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1, padding: "10px 12px", background: "#fff3e8", borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#e85d04", fontWeight: 600 }}>UYU</div>
                  <div style={{ fontSize: mobile ? 16 : 18, fontWeight: 800, color: "#e85d04" }}>{fmt(currencyBreakdown.uyu)}</div>
                  <div style={{ fontSize: 10, color: "#8b8b9e" }}>{currencyBreakdown.uyuPct}%</div>
                </div>
                {currencyBreakdown.usd > 0 && <div style={{ flex: 1, padding: "10px 12px", background: "#eff6ff", borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#3b82f6", fontWeight: 600 }}>USD</div>
                  <div style={{ fontSize: mobile ? 16 : 18, fontWeight: 800, color: "#3b82f6" }}>{fmt(currencyBreakdown.usd, "USD")}</div>
                  <div style={{ fontSize: 10, color: "#8b8b9e" }}>{100 - currencyBreakdown.uyuPct}%</div>
                </div>}
              </div>
              <div style={{ height: 8, background: "#f1f1f5", borderRadius: 4, overflow: "hidden", display: "flex" }}>
                <div style={{ width: `${currencyBreakdown.uyuPct}%`, height: "100%", background: "#e85d04" }} />
                {currencyBreakdown.usd > 0 && <div style={{ width: `${100 - currencyBreakdown.uyuPct}%`, height: "100%", background: "#3b82f6" }} />}
              </div>
            </>
          )}
        </Card>

        {/* Monthly obligations */}
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
      </div>
    </div>

    {/* ─── Month Comparison Card ─────────────────────────── */}
    <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 14 }}>
      <Card>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Próximos Vencimientos</h3>
        {stats.pending.filter(i => daysUntil(i.due_date) >= -5).sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).slice(0, 6).map(inv => {
          const sup = getSup(suppliers, inv.supplier_id);
          return <div key={inv.id} onClick={() => nav("inbox", inv.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #f3f3f6", cursor: "pointer" }}>
            <div><div style={{ fontSize: 13, fontWeight: 500 }}>{sup.alias}</div><div style={{ fontSize: 10, color: "#8b8b9e" }}>{inv.invoice_number}</div></div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 13, fontWeight: 700 }}>{fmt(inv.total, inv.currency)}</span><DueBadge d={inv.due_date} /></div>
          </div>;
        })}
        {stats.pending.filter(i => daysUntil(i.due_date) >= -5).length === 0 && <div style={{ fontSize: 12, color: "#8b8b9e", textAlign: "center", padding: 12 }}>Sin vencimientos próximos</div>}
      </Card>

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
    </div>
  </div>;
}
