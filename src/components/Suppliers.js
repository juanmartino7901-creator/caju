"use client";
import { useState } from "react";
import { fmt, BANK_CODES } from "@/lib/utils";
import { Card, Btn, Input, Select } from "@/components/SharedUI";

export default function Suppliers({ suppliers, setSuppliers, invoices, nav, mobile, onBatchDelete, categories, supabase, onReloadData }) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState(new Set());
  const [dedupPreview, setDedupPreview] = useState(null); // GET result
  const [dedupLoading, setDedupLoading] = useState(false);
  const [dedupResult, setDedupResult] = useState(null); // POST result
  const [form, setForm] = useState({ name: "", alias: "", tax_id: "", category: "Insumos", bank: "Itaú", account_type: "CC", account_number: "", currency: "UYU", phone: "", email: "", contact: "", payment_terms: "30 días", notes: "" });
  const filtered = suppliers.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.alias?.toLowerCase().includes(search.toLowerCase()) || s.tax_id?.includes(search));

  const toggleAll = () => setSel(sel.size === filtered.length ? new Set() : new Set(filtered.map(s => s.id)));

  const handleBatchDelete = async () => {
    const ok = await onBatchDelete([...sel]);
    if (ok) setSel(new Set());
  };

  const saveSupplier = async () => {
    try {
      const dbRow = {
        name: form.name, alias: form.alias, tax_id: form.tax_id, category: form.category,
        bank_name: form.bank, account_type: form.account_type, account_number: form.account_number,
        currency: form.currency, phone: form.phone, email: form.email, contact_name: form.contact,
        payment_terms: form.payment_terms, notes: form.notes,
      };
      const { data, error } = await supabase.from("suppliers").insert(dbRow).select().single();
      if (error) throw error;
      setSuppliers(p => [...p, { ...form, id: data.id }]);
    } catch (err) {
      console.error("Cajú: Error saving supplier", err);
      setSuppliers(p => [...p, { ...form, id: `s${Date.now()}` }]);
    }
    setShowForm(false);
  };

  const apiCall = async (method) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/suppliers/dedup", {
      method,
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    return await res.json();
  };

  const runDedupPreview = async () => {
    setDedupLoading(true);
    setDedupResult(null);
    const data = await apiCall("GET");
    setDedupPreview(data);
    setDedupLoading(false);
  };

  const executDedup = async () => {
    setDedupLoading(true);
    const data = await apiCall("POST");
    setDedupResult(data);
    setDedupLoading(false);
    if (data.success && onReloadData) onReloadData();
  };

  return <div style={{ animation: "fadeIn 0.25s ease", overflow: "hidden", maxWidth: "100%" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <h1 style={{ fontSize: mobile ? 20 : 22, fontWeight: 800 }}>Proveedores</h1>
      <div style={{ display: "flex", gap: 6 }}>
        <Btn variant="secondary" size="sm" onClick={runDedupPreview} disabled={dedupLoading}>Deduplicar</Btn>
        <Btn size={mobile ? "sm" : "md"} onClick={() => setShowForm(!showForm)}>+ Nuevo</Btn>
      </div>
    </div>

    {/* Dedup modal */}
    {(dedupPreview || dedupResult) && (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => { setDedupPreview(null); setDedupResult(null); }}>
        <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 20, maxWidth: 560, width: "100%", maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
          {dedupResult ? <>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Deduplicación completada</h3>
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <div style={{ padding: "10px 14px", background: "#d1fae5", borderRadius: 8, textAlign: "center", flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#10b981" }}>{dedupResult.duplicates_removed}</div>
                <div style={{ fontSize: 10, color: "#10b981", fontWeight: 600 }}>Eliminados</div>
              </div>
              <div style={{ padding: "10px 14px", background: "#dbeafe", borderRadius: 8, textAlign: "center", flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#3b82f6" }}>{dedupResult.invoices_reassigned}</div>
                <div style={{ fontSize: 10, color: "#3b82f6", fontWeight: 600 }}>Facturas reasignadas</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <Btn size="sm" onClick={() => { setDedupPreview(null); setDedupResult(null); }}>Cerrar</Btn>
            </div>
          </> : dedupPreview ? <>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Deduplicar proveedores</h3>
            <div style={{ fontSize: 12, color: "#8b8b9e", marginBottom: 12 }}>
              {dedupPreview.total_suppliers} proveedores total &middot; {dedupPreview.duplicate_groups} grupos duplicados &middot; {dedupPreview.duplicates_to_remove} a eliminar
            </div>

            {dedupPreview.duplicate_groups === 0 && (
              <div style={{ padding: 20, textAlign: "center", color: "#8b8b9e", fontSize: 13 }}>
                No se encontraron duplicados
              </div>
            )}

            {dedupPreview.groups?.map((g, i) => (
              <div key={i} style={{ padding: 10, marginBottom: 6, background: "#f7f7fa", borderRadius: 8, fontSize: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: g.match_type === "rut" ? "#dbeafe" : "#fef3c7", color: g.match_type === "rut" ? "#3b82f6" : "#d97706", fontWeight: 600 }}>{g.match_type === "rut" ? "RUT" : "Nombre"}</span>
                  <span style={{ fontWeight: 600, color: "#10b981" }}>Mantener: {g.keep.name}</span>
                  {g.keep.tax_id && <span style={{ color: "#8b8b9e" }}>({g.keep.tax_id})</span>}
                </div>
                {g.remove.map((r, j) => (
                  <div key={j} style={{ paddingLeft: 16, color: "#ef4444", fontSize: 11 }}>
                    Eliminar: {r.name}{r.tax_id ? ` (${r.tax_id})` : ""}
                  </div>
                ))}
              </div>
            ))}

            <div style={{ display: "flex", gap: 6, marginTop: 12, justifyContent: "flex-end" }}>
              <Btn variant="secondary" size="sm" onClick={() => { setDedupPreview(null); setDedupResult(null); }}>Cancelar</Btn>
              {dedupPreview.duplicate_groups > 0 && (
                <Btn variant="danger" size="sm" onClick={executDedup} disabled={dedupLoading}>
                  {dedupLoading ? "Procesando..." : `Ejecutar (eliminar ${dedupPreview.duplicates_to_remove})`}
                </Btn>
              )}
            </div>
          </> : null}
        </div>
      </div>
    )}

    {showForm && <Card style={{ marginBottom: 14, border: "2px solid #e85d04", overflow: "hidden" }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Nuevo Proveedor</h3>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: 8, maxWidth: "100%" }}>
        <Input label="Razón Social *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <Input label="Nombre Corto" value={form.alias} onChange={e => setForm(f => ({ ...f, alias: e.target.value }))} />
        <Input label="RUT *" value={form.tax_id} onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} placeholder="21.XXX.XXX.0001" />
        <Select label="Categoría" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{categories.map(c => <option key={c}>{c}</option>)}</Select>
        <Select label="Banco" value={form.bank} onChange={e => setForm(f => ({ ...f, bank: e.target.value }))}>{Object.keys(BANK_CODES).map(b => <option key={b}>{b}</option>)}</Select>
        <Select label="Tipo Cuenta" value={form.account_type} onChange={e => setForm(f => ({ ...f, account_type: e.target.value }))}><option value="CC">Cta Corriente</option><option value="CA">Caja Ahorro</option></Select>
        <Input label="N° Cuenta" value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} />
        <Input label="Teléfono" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
        <Input label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        <Input label="Contacto" value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} />
        <Select label="Cond. Pago" value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))}><option>Contado</option><option>15 días</option><option>30 días</option><option>60 días</option><option>Mensual</option></Select>
        <Input label="Notas" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10, justifyContent: "flex-end" }}><Btn variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancelar</Btn><Btn size="sm" onClick={saveSupplier} disabled={!form.name.trim() || !form.tax_id.trim()} style={!form.name.trim() || !form.tax_id.trim() ? { opacity: 0.5, cursor: "not-allowed" } : {}}>Guardar</Btn></div>
    </Card>}

    <input type="text" placeholder="🔍  Buscar proveedor, RUT..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e0e0e6", fontSize: 14, outline: "none", marginBottom: 10 }} />

    {filtered.length > 0 && <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
      <Btn variant="secondary" size="sm" onClick={toggleAll}>{sel.size === filtered.length ? "Deseleccionar" : `Seleccionar todo (${filtered.length})`}</Btn>
      {sel.size > 0 && <>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#e85d04" }}>{sel.size} seleccionado(s)</span>
        <Btn variant="danger" size="sm" onClick={handleBatchDelete}>🗑 Eliminar</Btn>
      </>}
    </div>}

    <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 8 }}>
      {filtered.map(sup => {
        const pending = invoices.filter(i => i.supplier_id === sup.id && !["PAID", "REJECTED"].includes(i.status)).reduce((s, i) => s + i.total, 0);
        const checked = sel.has(sup.id);
        return <Card key={sup.id} hover onClick={() => nav("suppliers", sup.id)} style={{ borderLeft: checked ? "3px solid #e85d04" : "3px solid transparent", background: checked ? "#fff8f3" : "#fff", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <input type="checkbox" checked={checked} onChange={() => {}} onClick={(e) => { e.stopPropagation(); setSel(p => { const n = new Set(p); n.has(sup.id) ? n.delete(sup.id) : n.add(sup.id); return n; }); }} style={{ accentColor: "#e85d04", width: 16, height: 16, flexShrink: 0, marginTop: 2, cursor: "pointer" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flex: 1, minWidth: 0, gap: 8 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sup.name}</div>
                <div style={{ fontSize: 11, color: "#8b8b9e", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sup.alias} · {sup.tax_id}</div>
                <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 3, background: "#f7f7fa", color: "#6b7280" }}>{sup.category}</span>
                  {sup.bank && sup.bank !== "—" && <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 3, background: "#fff3e8", color: "#e85d04" }}>🏦 {sup.bank}</span>}
                </div>
              </div>
              {pending > 0 && <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}><div style={{ fontSize: 9, color: "#8b8b9e" }}>Pendiente</div><div style={{ fontSize: 14, fontWeight: 800, color: "#e85d04" }}>{fmt(pending)}</div></div>}
            </div>
          </div>
        </Card>;
      })}
    </div>
  </div>;
}
