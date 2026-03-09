"use client";
import { useState } from "react";
import { fmt, fmtDate as fmtDateShort, BANK_CODES } from "@/lib/utils";
import { Card, Btn, Input, Select, Badge } from "@/components/SharedUI";

const fmtDate = fmtDateShort;

export default function SupDetail({ sup, invs, suppliers, setSuppliers, onBack, onDelete, notify, mobile, categories, supabase }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...sup });

  const save = async () => {
    try {
      const dbRow = {
        name: form.name, alias: form.alias, tax_id: form.tax_id, phone: form.phone, email: form.email,
        contact_name: form.contact, bank_name: form.bank, account_type: form.account_type,
        account_number: form.account_number, category: form.category, payment_terms: form.payment_terms, notes: form.notes,
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
