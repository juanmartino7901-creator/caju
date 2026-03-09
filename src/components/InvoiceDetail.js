"use client";
import { useState } from "react";
import { fmt, fmtDate as fmtDateShort, fmtDateFull, STATUSES } from "@/lib/utils";
import { Card, Btn, Input, Select, Badge, DueBadge, ConfBadge, ExtractionChecklist } from "@/components/SharedUI";
import DocPreview from "@/components/DocPreview";

const fmtDate = fmtDateShort;

export default function InvDetail({ inv, sup, suppliers, onBack, onUpdate, onDelete, notify, mobile, onReExtract, supabase }) {
  const hasLowConf = inv.confidence && Object.values(inv.confidence).some(v => v != null && v < 0.8);
  const [editing, setEditing] = useState(hasLowConf && ["REVIEW_REQUIRED", "EXTRACTED"].includes(inv.status));
  const [reExtracting, setReExtracting] = useState(false);
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

  const handleReExtract = async () => {
    if (!inv.file_path) { notify("Sin documento para re-extraer", "error"); return; }
    setReExtracting(true);
    try {
      await onReExtract(inv.id, inv.file_path);
      notify("Re-extracción completada");
    } catch {
      notify("Error al re-extraer", "error");
    } finally {
      setReExtracting(false);
    }
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

    <Card style={{ padding: 10, marginBottom: 10, background: "#fafafa" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#8b8b9e", marginBottom: 4 }}>Resumen Extracción</div>
          <ExtractionChecklist inv={inv} sup={sup} />
        </div>
        {inv.file_path && <Btn variant="secondary" size="sm" onClick={handleReExtract} disabled={reExtracting}>
          {reExtracting ? "⏳ Re-extrayendo..." : "🔄 Re-extraer"}
        </Btn>}
      </div>
    </Card>

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
          {hasLowConf && <div style={{ padding: "6px 10px", background: "#fef3c7", borderRadius: 6, fontSize: 11, color: "#92400e", fontWeight: 500 }}>⚠ Algunos campos tienen baja confianza — revisalos antes de aprobar</div>}
          <Select label="Proveedor" value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}>
            <option value="">— Sin asignar —</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.alias || s.name} ({s.tax_id})</option>)}
          </Select>
          <Input label="N° Factura" value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} style={inv.confidence?.invoice_number != null && inv.confidence.invoice_number < 0.8 ? { borderColor: "#dc2626", background: "#fff5f5" } : {}} />
          <Input label="Emisión" type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} style={inv.confidence?.issue_date != null && inv.confidence.issue_date < 0.8 ? { borderColor: "#dc2626", background: "#fff5f5" } : {}} />
          <Input label="Vencimiento" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} style={inv.confidence?.due_date != null && inv.confidence.due_date < 0.8 ? { borderColor: "#dc2626", background: "#fff5f5" } : {}} />
          <Input label="Subtotal" type="number" value={form.subtotal} onChange={e => setForm(f => ({ ...f, subtotal: e.target.value }))} />
          <Input label="IVA" type="number" value={form.tax_amount} onChange={e => setForm(f => ({ ...f, tax_amount: e.target.value }))} style={inv.confidence?.tax_amount != null && inv.confidence.tax_amount < 0.8 ? { borderColor: "#dc2626", background: "#fff5f5" } : {}} />
          <Input label="Total" type="number" value={form.total} onChange={e => setForm(f => ({ ...f, total: e.target.value }))} style={inv.confidence?.total != null && inv.confidence.total < 0.8 ? { borderColor: "#dc2626", background: "#fff5f5" } : {}} />
          <Select label="Moneda" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}><option>UYU</option><option>USD</option></Select>
          <Btn variant="secondary" size="sm" onClick={() => setEditing(false)}>Cancelar</Btn>
        </div> : <div>
          {fields.map(([label, value, key], i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #f5f5f8" }}>
              <span style={{ fontSize: 12, color: "#8b8b9e" }}>{label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{value}</span>
                <ConfBadge value={inv.confidence?.[key]} />
              </div>
            </div>
          ))}
          {sup.bank && sup.bank !== "—" && <div style={{ marginTop: 8, padding: "8px 10px", background: "#f7f7fa", borderRadius: 7, fontSize: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#8b8b9e", marginBottom: 3 }}>BANCO PROVEEDOR</div>
            {sup.bank} · {sup.account_type} · {sup.account_number}
          </div>}
        </div>}
      </Card>
      <DocPreview inv={inv} supabase={supabase} />
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
