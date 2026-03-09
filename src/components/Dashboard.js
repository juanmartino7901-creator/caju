"use client";
import { useMemo } from "react";
import { fmt, fmtDate as fmtDateShort, daysUntil, STATUSES } from "@/lib/utils";
import { Card, Badge, DueBadge } from "@/components/SharedUI";

const fmtDate = fmtDateShort;
const getSup = (suppliers, id) => suppliers.find(s => s.id === id) || {};

export default function Dashboard({ stats, invoices, recurring, suppliers, nav, mobile }) {
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
