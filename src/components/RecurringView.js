"use client";
import { useState, useMemo } from "react";
import { fmt } from "@/lib/utils";
import { Card, Btn, Input, Select, Progress } from "@/components/SharedUI";

const RECURRING_TYPES = {
  fixed_cost: { label: "Costo Fijo", icon: "📋", color: "#6366f1" },
  owner_withdrawal: { label: "Retiro Socio", icon: "👤", color: "#8b5cf6" },
  installment: { label: "Cuota Tarjeta", icon: "💳", color: "#f59e0b" },
};

const getSup = (suppliers, id) => suppliers.find(s => s.id === id) || {};

export default function RecurringView({ recurring, setRecurring, suppliers, onDelete, notify, mobile, categories, updateCategories, supabase }) {
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

    try {
      const dbRow = {
        name: item.name, type: item.type, estimated_amount: item.amount, day_of_month: item.day,
        category: item.category, supplier_id: item.supplier_id || null, active: true, is_variable: item.variable,
        currency: "UYU", frequency: "monthly", total_installments: item.total_installments || null,
        current_installment: item.current_installment || null, credit_card_last4: item.card_last4 || null,
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
