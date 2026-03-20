"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { fmt } from "@/lib/utils";
import { Card, Btn, Input, Select, Progress } from "@/components/SharedUI";

const RECURRING_TYPES = {
  fixed_cost: { label: "Costo Fijo", icon: "\u{1F4CB}", color: "#6366f1" },
  owner_withdrawal: { label: "Retiro Socio", icon: "\u{1F464}", color: "#8b5cf6" },
  installment: { label: "Cuota Tarjeta", icon: "\u{1F4B3}", color: "#f59e0b" },
};

const INSTANCE_STATUS = {
  pending: { label: "Pendiente", color: "#f59e0b", bg: "#fef3c7" },
  invoice_linked: { label: "Factura asociada", color: "#10b981", bg: "#d1fae5" },
  paid_manual: { label: "Pagado manual", color: "#3b82f6", bg: "#dbeafe" },
};

const MONTHS_ES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const getSup = (suppliers, id) => suppliers.find(s => s.id === id) || {};

function getPeriod(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatPeriodLabel(period) {
  const [y, m] = period.split("-");
  return `${MONTHS_ES[parseInt(m) - 1]} ${y}`;
}

function shiftPeriod(period, delta) {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return getPeriod(d);
}

export default function RecurringView({ recurring, setRecurring, suppliers, invoices, onDelete, notify, nav, mobile, categories, updateCategories, supabase }) {
  const [tab, setTab] = useState("checklist"); // "checklist" | "manage"
  const [period, setPeriod] = useState(() => getPeriod(new Date()));
  const [instances, setInstances] = useState([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showCatEditor, setShowCatEditor] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [form, setForm] = useState({ type: "fixed_cost", name: "", amount: "", day: "1", supplier_id: "", category: "Servicios", total_installments: "", current_installment: "", card_last4: "" });
  const [linkingId, setLinkingId] = useState(null); // instance id being linked
  const [paidForm, setPaidForm] = useState(null); // { instanceId, amount, date }

  // ─── API helper ──────────────────────────────────────
  const apiCall = useCallback(async (method, body, params) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const opts = { method, headers: { Authorization: `Bearer ${session?.access_token}` } };
      if (body) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
      let url = "/api/recurring-instances";
      if (params) url += "?" + new URLSearchParams(params).toString();
      const res = await fetch(url, opts);
      return await res.json();
    } catch { return null; }
  }, [supabase]);

  // ─── Load instances for period ───────────────────────
  const loadInstances = useCallback(async (p) => {
    setLoadingInstances(true);
    // Batch-create if needed, then fetch
    const res = await apiCall("POST", { batch: true, period: p });
    if (res?.success) {
      setInstances(res.data || []);
    } else {
      // Fallback: just GET
      const getRes = await apiCall("GET", null, { period: p });
      setInstances(getRes?.data || []);
    }
    setLoadingInstances(false);
  }, [apiCall]);

  useEffect(() => {
    if (tab === "checklist") loadInstances(period);
  }, [period, tab, loadInstances]);

  // ─── Enrich instances with recurring data ────────────
  const enriched = useMemo(() => {
    return instances.map(inst => {
      const rec = recurring.find(r => r.id === inst.recurring_id);
      if (!rec) return null;
      const sup = rec.supplier_id ? getSup(suppliers, rec.supplier_id) : null;
      const linkedInvoice = inst.invoice_id ? invoices.find(i => i.id === inst.invoice_id) : null;
      return { ...inst, rec, sup, linkedInvoice };
    }).filter(Boolean);
  }, [instances, recurring, suppliers, invoices]);

  // ─── Summary stats ──────────────────────────────────
  const summary = useMemo(() => {
    const total = enriched.length;
    const resolved = enriched.filter(e => e.status !== "pending").length;
    const estimated = enriched.reduce((s, e) => s + (e.rec?.amount || 0), 0);
    const actual = enriched.reduce((s, e) => {
      if (e.status === "invoice_linked" && e.linkedInvoice) return s + (e.linkedInvoice.total || 0);
      if (e.status === "paid_manual" && e.paid_amount) return s + e.paid_amount;
      return s;
    }, 0);
    return { total, resolved, estimated, actual };
  }, [enriched]);

  // ─── Link invoice to instance ────────────────────────
  const linkInvoice = useCallback(async (instanceId, invoiceId) => {
    const res = await apiCall("PATCH", { id: instanceId, status: "invoice_linked", invoice_id: invoiceId });
    if (res?.success) {
      setInstances(prev => prev.map(i => i.id === instanceId ? { ...i, status: "invoice_linked", invoice_id: invoiceId } : i));
      notify("Factura asociada al recurrente");
    } else {
      notify("Error al asociar factura", "error");
    }
    setLinkingId(null);
  }, [apiCall, notify]);

  // ─── Mark as paid manual ─────────────────────────────
  const markPaid = useCallback(async (instanceId, amount, date) => {
    const res = await apiCall("PATCH", { id: instanceId, status: "paid_manual", paid_amount: Number(amount), paid_date: date });
    if (res?.success) {
      setInstances(prev => prev.map(i => i.id === instanceId ? { ...i, status: "paid_manual", paid_amount: Number(amount), paid_date: date } : i));
      notify("Marcado como pagado");
    } else {
      notify("Error al marcar como pagado", "error");
    }
    setPaidForm(null);
  }, [apiCall, notify]);

  // ─── Candidate invoices for linking ──────────────────
  const getCandidateInvoices = useCallback((rec) => {
    if (!rec) return [];
    return invoices.filter(i => {
      if (rec.supplier_id && i.supplier_id === rec.supplier_id) return true;
      return false;
    });
  }, [invoices]);

  // ─── Manage tab: form & save ─────────────────────────
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
      console.error("Error saving recurring", err);
      if (editId) {
        setRecurring(prev => prev.map(r => r.id === editId ? { ...r, ...item } : r));
      } else {
        setRecurring(prev => [...prev, { ...item, id: `r${Date.now()}` }]);
      }
    }
    setShowForm(false); setEditId(null);
  };

  return <div style={{ animation: "fadeIn 0.25s ease" }}>
    {/* Header */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
      <h1 style={{ fontSize: mobile ? 20 : 22, fontWeight: 800 }}>Fijos & Cuotas</h1>
      <div style={{ display: "flex", gap: 4 }}>
        <Btn variant={tab === "checklist" ? "primary" : "secondary"} size="sm" onClick={() => setTab("checklist")}>Checklist</Btn>
        <Btn variant={tab === "manage" ? "primary" : "secondary"} size="sm" onClick={() => setTab("manage")}>Gestionar</Btn>
      </div>
    </div>

    {/* ════════════════════════════════════════════════════ */}
    {/* CHECKLIST TAB                                       */}
    {/* ════════════════════════════════════════════════════ */}
    {tab === "checklist" && <>
      {/* Period selector */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 14 }}>
        <button onClick={() => setPeriod(p => shiftPeriod(p, -1))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#8b8b9e", padding: "4px 8px" }}>&lt;</button>
        <div style={{ fontSize: 16, fontWeight: 700, minWidth: 160, textAlign: "center" }}>{formatPeriodLabel(period)}</div>
        <button onClick={() => setPeriod(p => shiftPeriod(p, 1))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#8b8b9e", padding: "4px 8px" }}>&gt;</button>
      </div>

      {/* Summary bar */}
      <Card style={{ marginBottom: 14, background: "linear-gradient(135deg, #1a1a2e, #2d2b55)", color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: "#e85d04", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Resueltos</div>
            <div style={{ fontSize: mobile ? 22 : 26, fontWeight: 800, marginTop: 2 }}>{summary.resolved} de {summary.total}</div>
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#a0a0c0" }}>Estimado</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{fmt(summary.estimated)}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#a0a0c0" }}>Real</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2, color: "#10b981" }}>{fmt(summary.actual)}</div>
            </div>
          </div>
        </div>
        {summary.total > 0 && <div style={{ marginTop: 10, background: "rgba(255,255,255,0.15)", borderRadius: 4, height: 6, overflow: "hidden" }}>
          <div style={{ height: "100%", background: "#e85d04", borderRadius: 4, width: `${Math.round((summary.resolved / summary.total) * 100)}%`, transition: "width 0.3s" }} />
        </div>}
      </Card>

      {/* Instance list */}
      {loadingInstances && <div style={{ textAlign: "center", padding: 30, color: "#8b8b9e", fontSize: 13 }}>Cargando...</div>}

      {!loadingInstances && enriched.length === 0 && (
        <Card style={{ textAlign: "center", padding: 30, color: "#8b8b9e" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>{"\u{1F4CB}"}</div>
          <div style={{ fontSize: 13 }}>No hay recurrentes activos para este mes</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>Crea gastos recurrentes en la pesta&ntilde;a "Gestionar"</div>
        </Card>
      )}

      {!loadingInstances && enriched.map(item => {
        const st = INSTANCE_STATUS[item.status];
        const rt = RECURRING_TYPES[item.rec.type] || RECURRING_TYPES.fixed_cost;
        const isLinking = linkingId === item.id;
        const isPaidForm = paidForm?.instanceId === item.id;
        const candidates = isLinking ? getCandidateInvoices(item.rec) : [];

        return <Card key={item.id} style={{ padding: "12px 14px", marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14 }}>{rt.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{item.rec.name}</span>
                <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 4, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span>
              </div>
              <div style={{ fontSize: 11, color: "#8b8b9e", marginTop: 2 }}>
                {item.sup ? `${item.sup.alias} \u00B7 ` : ""}D\u00EDa {item.rec.day}
                {item.status === "invoice_linked" && item.linkedInvoice && ` \u00B7 Fact. #${item.linkedInvoice.invoice_number}`}
                {item.status === "paid_manual" && item.paid_date && ` \u00B7 Pagado ${item.paid_date}`}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: rt.color }}>{fmt(item.rec.amount)}</div>
                {item.status === "paid_manual" && item.paid_amount != null && item.paid_amount !== item.rec.amount && (
                  <div style={{ fontSize: 10, color: "#8b8b9e" }}>Real: {fmt(item.paid_amount)}</div>
                )}
                {item.status === "invoice_linked" && item.linkedInvoice && item.linkedInvoice.total !== item.rec.amount && (
                  <div style={{ fontSize: 10, color: "#8b8b9e" }}>Real: {fmt(item.linkedInvoice.total)}</div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          {item.status === "pending" && !isLinking && !isPaidForm && (
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {item.rec.supplier_id && <Btn size="sm" variant="secondary" onClick={() => setLinkingId(item.id)}>Asociar factura</Btn>}
              <Btn size="sm" variant="secondary" onClick={() => setPaidForm({ instanceId: item.id, amount: String(item.rec.amount), date: new Date().toISOString().split("T")[0] })}>Marcar pagado</Btn>
            </div>
          )}

          {/* Invoice linking selector */}
          {isLinking && (
            <div style={{ marginTop: 8, padding: 10, background: "#f7f7fa", borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: "#8b8b9e" }}>Seleccionar factura del proveedor:</div>
              {candidates.length === 0 && <div style={{ fontSize: 11, color: "#8b8b9e" }}>No hay facturas de este proveedor</div>}
              {candidates.map(inv => (
                <button key={inv.id} onClick={() => linkInvoice(item.id, inv.id)} style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "6px 8px", margin: "2px 0", background: "#fff", border: "1px solid #e8e8ec", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                  <span>#{inv.invoice_number} &middot; {inv.issue_date || "sin fecha"}</span>
                  <span style={{ fontWeight: 700 }}>{fmt(inv.total)}</span>
                </button>
              ))}
              <Btn size="sm" variant="secondary" onClick={() => setLinkingId(null)} style={{ marginTop: 6 }}>Cancelar</Btn>
            </div>
          )}

          {/* Paid manual form */}
          {isPaidForm && (
            <div style={{ marginTop: 8, padding: 10, background: "#f7f7fa", borderRadius: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                <Input label="Monto" type="number" value={paidForm.amount} onChange={e => setPaidForm(f => ({ ...f, amount: e.target.value }))} style={{ flex: 1, minWidth: 100 }} />
                <Input label="Fecha" type="date" value={paidForm.date} onChange={e => setPaidForm(f => ({ ...f, date: e.target.value }))} style={{ flex: 1, minWidth: 130 }} />
                <div style={{ display: "flex", gap: 4 }}>
                  <Btn size="sm" onClick={() => markPaid(paidForm.instanceId, paidForm.amount, paidForm.date)}>Confirmar</Btn>
                  <Btn size="sm" variant="secondary" onClick={() => setPaidForm(null)}>Cancelar</Btn>
                </div>
              </div>
            </div>
          )}

          {/* View linked invoice */}
          {item.status === "invoice_linked" && item.linkedInvoice && nav && (
            <div style={{ marginTop: 6 }}>
              <Btn size="sm" variant="secondary" onClick={() => nav("inbox", item.linkedInvoice.id)}>Ver factura</Btn>
            </div>
          )}
        </Card>;
      })}
    </>}

    {/* ════════════════════════════════════════════════════ */}
    {/* MANAGE TAB (existing functionality)                 */}
    {/* ════════════════════════════════════════════════════ */}
    {tab === "manage" && <>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: 12 }}>
        <Btn variant="secondary" size="sm" onClick={() => setShowCatEditor(!showCatEditor)}>{"\u{1F3F7}"} Categor&iacute;as</Btn>
        <Btn size={mobile ? "sm" : "md"} onClick={() => { setEditId(null); setForm({ type: "fixed_cost", name: "", amount: "", day: "1", supplier_id: "", category: "Servicios", total_installments: "", current_installment: "", card_last4: "" }); setShowForm(!showForm); }}>+ Nuevo</Btn>
      </div>

      {showCatEditor && <Card style={{ marginBottom: 14, border: "1px solid #e0e0e6" }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Editar Categor&iacute;as</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {categories.map(c => (
            <div key={c} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", background: "#f7f7fa", borderRadius: 6, fontSize: 12, fontWeight: 500 }}>
              {c}
              <button onClick={() => { if (confirm(`\u00BFEliminar categor\u00EDa "${c}"?`)) updateCategories(categories.filter(x => x !== c)); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#dc2626", padding: 0, lineHeight: 1 }}>{"\u2715"}</button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input type="text" value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Nueva categor\u00EDa..." onKeyDown={e => { if (e.key === "Enter" && newCat.trim()) { updateCategories([...categories, newCat.trim()]); setNewCat(""); } }} style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid #e0e0e6", fontSize: 13, outline: "none" }} />
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
          <Input label="D&iacute;a del mes" type="number" value={form.day} onChange={e => setForm(f => ({ ...f, day: e.target.value }))} />
          <Select label="Categor&iacute;a" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{[...categories, "Retiro", "Tarjeta"].map(c => <option key={c}>{c}</option>)}</Select>
          <Select label="Proveedor" value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}><option value="">&mdash; Ninguno &mdash;</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.alias}</option>)}</Select>
          {form.type === "installment" && <>
            <Input label="Total cuotas" type="number" value={form.total_installments} onChange={e => setForm(f => ({ ...f, total_installments: e.target.value }))} />
            <Input label="Cuota actual" type="number" value={form.current_installment} onChange={e => setForm(f => ({ ...f, current_installment: e.target.value }))} />
            <Input label="Tarjeta ****" value={form.card_last4} onChange={e => setForm(f => ({ ...f, card_last4: e.target.value }))} />
          </>}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10, justifyContent: "flex-end" }}><Btn variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancelar</Btn><Btn size="sm" onClick={save} disabled={!form.name.trim() || !form.amount || Number(form.amount) <= 0} style={!form.name.trim() || !form.amount || Number(form.amount) <= 0 ? { opacity: 0.5, cursor: "not-allowed" } : {}}>Guardar</Btn></div>
      </Card>}

      {Object.entries(RECURRING_TYPES).map(([key, type]) => <div key={key} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}><span style={{ fontSize: 16 }}>{type.icon}</span><h2 style={{ fontSize: 14, fontWeight: 700 }}>{type.label}</h2><span style={{ fontSize: 11, color: "#8b8b9e" }}>&mdash; {fmt(grouped[key]?.reduce((s, r) => s + r.amount, 0) || 0)}/mes</span></div>
        {grouped[key]?.map(item => {
          const sup = item.supplier_id ? getSup(suppliers, item.supplier_id) : null;
          return <Card key={item.id} style={{ padding: "11px 14px", marginBottom: 5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}><span style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</span>{item.variable && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "#fef3c7", color: "#d97706", fontWeight: 600 }}>Variable</span>}</div>
                <div style={{ fontSize: 11, color: "#8b8b9e", marginTop: 2 }}>{sup ? `${sup.alias} \u00B7 ` : ""}D\u00EDa {item.day}{item.card_last4 ? ` \u00B7 ****${item.card_last4}` : ""}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <div style={{ textAlign: "right" }}><div style={{ fontSize: 16, fontWeight: 800, color: type.color }}>{fmt(item.amount)}</div>{item.total_installments && <div style={{ width: 90, marginTop: 2 }}><Progress current={item.current_installment} total={item.total_installments} color={type.color} /></div>}</div>
                <button onClick={() => startEdit(item)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 4 }}>{"\u270F\uFE0F"}</button>
                <button onClick={() => onDelete(item.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 4 }}>{"\u{1F5D1}"}</button>
              </div>
            </div>
          </Card>;
        })}
      </div>)}
    </>}
  </div>;
}
