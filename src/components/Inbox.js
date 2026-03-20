"use client";
import { useState, useMemo, useEffect } from "react";
import { fmt, fmtDate as fmtDateShort, STATUSES } from "@/lib/utils";
import { Card, Btn, Input, Select, Badge, DueBadge, Pagination, PAGE_SIZE } from "@/components/SharedUI";

const fmtDate = fmtDateShort;
const getSup = (suppliers, id) => suppliers.find(s => s.id === id) || {};

export default function Inbox({ invoices, suppliers, filters, setFilters, nav, notify, mobile, onInvoiceUploaded, onBatchUpdate, onBatchDelete, supabase, uploadState, onStartUpload, onDismissUpload }) {
  const [showUpload, setShowUpload] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [sel, setSel] = useState(new Set());
  const [sortBy, setSortBy] = useState("recent");
  const [page, setPage] = useState(1);
  const [filterSupplier, setFilterSupplier] = useState("ALL");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [failedFile, setFailedFile] = useState(null);
  const [manualForm, setManualForm] = useState({ invoice_number: "", issue_date: "", due_date: "", total: "", currency: "UYU", supplier_id: "" });

  const uploading = uploadState?.active || false;

  const filtered = useMemo(() => {
    let list = invoices;
    if (filters.status !== "ALL") list = list.filter(i => i.status === filters.status);
    if (filters.search) {
      const t = filters.search.toLowerCase();
      list = list.filter(i => {
        const s = getSup(suppliers, i.supplier_id);
        const matchText = s.name?.toLowerCase().includes(t) || s.alias?.toLowerCase().includes(t) || i.invoice_number.toLowerCase().includes(t);
        const matchAmount = !isNaN(t.replace(/[$.,\s]/g, "")) && t.replace(/[$.,\s]/g, "").length > 0 && String(i.total).includes(t.replace(/[$.,\s]/g, ""));
        return matchText || matchAmount;
      });
    }
    if (filterSupplier !== "ALL") list = list.filter(i => i.supplier_id === filterSupplier);
    if (filterDateFrom) list = list.filter(i => i.due_date >= filterDateFrom);
    if (filterDateTo) list = list.filter(i => i.due_date <= filterDateTo);
    switch (sortBy) {
      case "due": return [...list].sort((a, b) => new Date(a.due_date || "2099-12-31") - new Date(b.due_date || "2099-12-31"));
      case "amount_desc": return [...list].sort((a, b) => b.total - a.total);
      case "amount_asc": return [...list].sort((a, b) => a.total - b.total);
      case "supplier": return [...list].sort((a, b) => (getSup(suppliers, a.supplier_id).alias || "").localeCompare(getSup(suppliers, b.supplier_id).alias || ""));
      case "issue": return [...list].sort((a, b) => new Date(b.issue_date || 0) - new Date(a.issue_date || 0));
      default: return [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  }, [invoices, filters, suppliers, sortBy, filterSupplier, filterDateFrom, filterDateTo]);

  const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);
  useEffect(() => { setPage(1); }, [filters.status, filters.search, filterSupplier, filterDateFrom, filterDateTo]);

  const hasActiveFilters = filters.search || filters.status !== "ALL" || filterSupplier !== "ALL" || filterDateFrom || filterDateTo;
  const resultLabel = hasActiveFilters ? "resultados" : "facturas";

  const toggleAll = () => setSel(sel.size === filtered.length ? new Set() : new Set(filtered.map(i => i.id)));
  const selIds = [...sel];
  const clearAllFilters = () => { setFilters({ status: "ALL", search: "" }); setFilterSupplier("ALL"); setFilterDateFrom(""); setFilterDateTo(""); };

  const handleBatchAction = async (action) => {
    let ok;
    if (action === "delete") { ok = await onBatchDelete(selIds); }
    else { ok = await onBatchUpdate(selIds, { status: action }); }
    if (ok) setSel(new Set());
  };

  const handleUpload = (files) => {
    if (!files || files.length === 0 || uploading) return;
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    const valid = Array.from(files).filter(f => {
      if (!allowed.includes(f.type)) { notify(`${f.name}: formato no soportado`, "error"); return false; }
      if (f.size > 10 * 1024 * 1024) { notify(`${f.name}: demasiado grande (m\u00e1x 10MB)`, "error"); return false; }
      return true;
    });
    if (valid.length === 0) return;
    setShowUpload(false);
    onStartUpload(valid);
  };

  const onFileSelect = (e) => { if (e.target.files?.length) handleUpload(e.target.files); e.target.value = ""; };
  const onDrop = (e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) handleUpload(e.dataTransfer.files); };

  return <div style={{ animation: "fadeIn 0.25s ease" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <div>
        <h1 style={{ fontSize: mobile ? 20 : 22, fontWeight: 800 }}>Inbox</h1>
        <span style={{ fontSize: 12, color: "#8b8b9e", fontWeight: 500 }}>{hasActiveFilters ? `${filtered.length} resultados para tu b\u00fasqueda` : `${invoices.length} facturas`}</span>
      </div>
      <Btn size={mobile ? "sm" : "md"} onClick={() => setShowUpload(!showUpload)} disabled={uploading}>{uploading ? `\u2699\uFE0F ${uploadState.processed}/${uploadState.total}` : "\u{1F4E4} Subir"}</Btn>
    </div>

    {showUpload && !uploading && <Card
      style={{ marginBottom: 12, border: `2px dashed ${dragOver ? "#e85d04" : "#e0c4a8"}`, background: dragOver ? "#fff0e0" : "#fff8f3", textAlign: "center", padding: 24, transition: "all 0.15s" }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div style={{ fontSize: 32, marginBottom: 4, opacity: 0.3 }}>{"\u{1F4C4}"}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#e85d04" }}>Arrastr\u00e1 archivos o toc\u00e1 para seleccionar</div>
      <div style={{ fontSize: 11, color: "#8b8b9e", marginTop: 3 }}>PDF, JPG, PNG \u2014 M\u00e1x 10 MB \u2014 Pod\u00e9s subir varios a la vez</div>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 12, padding: "8px 16px", borderRadius: 8, background: "#e85d04", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        {"\u{1F4C1}"} Elegir archivo
        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple onChange={onFileSelect} style={{ display: "none" }} />
      </label>
    </Card>}

    {failedFile && <Card style={{ marginBottom: 12, border: "2px solid #f59e0b", background: "#fffbeb" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>{"\u26A0"} Extracci\u00f3n fallida \u2014 Carga manual</h3>
          <div style={{ fontSize: 11, color: "#92400e", marginTop: 2 }}>No se pudieron extraer datos de &quot;{failedFile.name}&quot;. Complet\u00e1 los datos manualmente.</div>
        </div>
        <button onClick={() => { setFailedFile(null); setManualForm({ invoice_number: "", issue_date: "", due_date: "", total: "", currency: "UYU", supplier_id: "" }); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#92400e" }}>{"\u2715"}</button>
      </div>
      <div style={{ display: "flex", gap: 12, flexDirection: mobile ? "column" : "row" }}>
        <div style={{ flexShrink: 0, width: mobile ? "100%" : 200, height: 160, borderRadius: 8, overflow: "hidden", border: "1px solid #e0e0e6", background: "#fff" }}>
          {failedFile.type === "application/pdf"
            ? <iframe src={failedFile.url} style={{ width: "100%", height: "100%", border: "none" }} title="Preview" />
            : <img src={failedFile.url} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          }
        </div>
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 6 }}>
          <Select label="Proveedor" value={manualForm.supplier_id} onChange={e => setManualForm(f => ({ ...f, supplier_id: e.target.value }))}>
            <option value="">&mdash; Seleccionar &mdash;</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.alias || s.name}</option>)}
          </Select>
          <Input label="N&deg; Factura" value={manualForm.invoice_number} onChange={e => setManualForm(f => ({ ...f, invoice_number: e.target.value }))} />
          <Input label="Emisi\u00f3n" type="date" value={manualForm.issue_date} onChange={e => setManualForm(f => ({ ...f, issue_date: e.target.value }))} />
          <Input label="Vencimiento" type="date" value={manualForm.due_date} onChange={e => setManualForm(f => ({ ...f, due_date: e.target.value }))} />
          <Input label="Total" type="number" value={manualForm.total} onChange={e => setManualForm(f => ({ ...f, total: e.target.value }))} />
          <Select label="Moneda" value={manualForm.currency} onChange={e => setManualForm(f => ({ ...f, currency: e.target.value }))}><option>UYU</option><option>USD</option></Select>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10, justifyContent: "flex-end" }}>
        <Btn variant="secondary" size="sm" onClick={() => { setFailedFile(null); setManualForm({ invoice_number: "", issue_date: "", due_date: "", total: "", currency: "UYU", supplier_id: "" }); }}>Cancelar</Btn>
        <Btn size="sm" disabled={!manualForm.total} style={!manualForm.total ? { opacity: 0.5, cursor: "not-allowed" } : {}} onClick={async () => {
          try {
            const { data, error } = await supabase.from("invoices").insert({
              invoice_number: manualForm.invoice_number || "\u2014",
              issue_date: manualForm.issue_date || null,
              due_date: manualForm.due_date || null,
              total: Number(manualForm.total),
              subtotal: Math.round(Number(manualForm.total) / 1.22),
              tax_amount: Number(manualForm.total) - Math.round(Number(manualForm.total) / 1.22),
              currency: manualForm.currency,
              supplier_id: manualForm.supplier_id || null,
              status: "REVIEW_REQUIRED",
              source: "manual",
              confidence_scores: {},
            }).select().single();
            if (error) throw error;
            notify("Factura cargada manualmente");
            setFailedFile(null);
            setManualForm({ invoice_number: "", issue_date: "", due_date: "", total: "", currency: "UYU", supplier_id: "" });
            if (onInvoiceUploaded) onInvoiceUploaded();
          } catch (err) {
            notify("Error al guardar: " + (err.message || "error"), "error");
          }
        }}>{"\u{1F4BE}"} Guardar manualmente</Btn>
      </div>
    </Card>}

    <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
      <input type="text" placeholder="\u{1F50D}  Buscar proveedor, n\u00famero, monto..." value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #e0e0e6", fontSize: 14, outline: "none" }} />
      <button onClick={() => setShowFilters(!showFilters)} style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${showFilters || hasActiveFilters ? "#e85d04" : "#e0e0e6"}`, background: showFilters ? "#fff8f3" : "#fff", color: showFilters || hasActiveFilters ? "#e85d04" : "#6b7280", fontSize: 14, cursor: "pointer", flexShrink: 0, fontWeight: 600 }} title="Filtros avanzados">
        {"\u2699"} {hasActiveFilters && filterSupplier !== "ALL" || filterDateFrom || filterDateTo ? "\u25CF" : ""}
      </button>
    </div>

    {showFilters && <Card style={{ marginBottom: 8, padding: 12, border: "1px solid #e0e0e6" }}>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: 8, alignItems: "end" }}>
        <Select label="Proveedor" value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}>
          <option value="ALL">Todos</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.alias || s.name}</option>)}
        </Select>
        <Input label="Fecha desde" type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
        <Input label="Fecha hasta" type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
      </div>
      {(filterSupplier !== "ALL" || filterDateFrom || filterDateTo) && <div style={{ marginTop: 8, textAlign: "right" }}>
        <Btn variant="ghost" size="sm" onClick={() => { setFilterSupplier("ALL"); setFilterDateFrom(""); setFilterDateTo(""); }}>Limpiar filtros avanzados</Btn>
      </div>}
    </Card>}

    <div style={{ display: "flex", gap: 5, marginBottom: 10, overflowX: "auto", paddingBottom: 4 }}>
      {["ALL", "NEW", "REVIEW_REQUIRED", "EXTRACTED", "APPROVED", "SCHEDULED", "PAID"].map(st => (
        <button key={st} onClick={() => { setFilters(f => ({ ...f, status: st })); setSel(new Set()); }} style={{ padding: "5px 9px", borderRadius: 6, border: "1px solid #e0e0e6", background: filters.status === st ? "#e85d04" : "#fff", color: filters.status === st ? "#fff" : "#6b7280", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
          {st === "ALL" ? "Todas" : STATUSES[st]?.label}
        </button>
      ))}
    </div>

    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, flexWrap: "wrap" }}>
        {filtered.length > 0 && <Btn variant="secondary" size="sm" onClick={toggleAll}>{sel.size === filtered.length ? "Deseleccionar" : `Seleccionar todo (${filtered.length})`}</Btn>}
        {sel.size > 0 && <>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#e85d04" }}>{sel.size} seleccionada(s)</span>
          <Btn variant="success" size="sm" onClick={() => handleBatchAction("APPROVED")}>{"\u2705"} Aprobar</Btn>
          <Btn variant="primary" size="sm" onClick={() => handleBatchAction("EXTRACTED")}>{"\u2713"} Extra\u00edda</Btn>
          <Btn variant="danger" size="sm" onClick={() => handleBatchAction("REJECTED")}>{"\u2715"} Rechazar</Btn>
          <Btn variant="danger" size="sm" onClick={() => handleBatchAction("delete")}>{"\u{1F5D1}"} Eliminar</Btn>
        </>}
      </div>
      <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #e0e0e6", fontSize: 11, fontWeight: 600, color: "#6b7280", background: "#fff", cursor: "pointer", flexShrink: 0 }}>
        <option value="recent">Más recientes</option>
        <option value="due">{"Vencimiento ↑"}</option>
        <option value="issue">{"Emisión ↓"}</option>
        <option value="amount_desc">{"Monto ↓"}</option>
        <option value="amount_asc">{"Monto ↑"}</option>
        <option value="supplier">Proveedor A-Z</option>
      </select>
    </div>

    <Pagination page={page} setPage={setPage} totalItems={filtered.length} label={resultLabel} />

    {paged.map(inv => {
      const sup = getSup(suppliers, inv.supplier_id);
      const checked = sel.has(inv.id);
      return <Card key={inv.id} hover onClick={() => nav("inbox", inv.id)} style={{ padding: mobile ? "12px 14px" : "10px 14px", marginBottom: 5, borderLeft: checked ? "3px solid #e85d04" : "3px solid transparent", background: checked ? "#fff8f3" : "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="checkbox" checked={checked} onChange={() => {}} onClick={(e) => { e.stopPropagation(); setSel(p => { const n = new Set(p); n.has(inv.id) ? n.delete(inv.id) : n.add(inv.id); return n; }); }} style={{ accentColor: "#e85d04", width: 16, height: 16, flexShrink: 0, cursor: "pointer" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sup.alias || sup.name || "Sin proveedor"}</span>
                  <Badge status={inv.status} />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#8b8b9e" }}>{inv.invoice_number}</span>
                  <span style={{ fontSize: 11, color: "#b0b0c0" }}>{fmtDate(inv.issue_date)}</span>
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{fmt(inv.total, inv.currency)}</div>
                <DueBadge d={inv.due_date} />
              </div>
            </div>
          </div>
        </div>
      </Card>;
    })}
    {filtered.length > PAGE_SIZE && <Pagination page={page} setPage={setPage} totalItems={filtered.length} label={resultLabel} />}
    {filtered.length === 0 && invoices.length === 0 && <Card style={{ textAlign: "center", padding: 28 }}>
      <div style={{ fontSize: 32, opacity: 0.2 }}>{"\u{1F4ED}"}</div>
      <div style={{ fontSize: 13, color: "#8b8b9e", marginTop: 4 }}>No ten\u00e9s facturas todav\u00eda</div>
      <Btn size="sm" style={{ marginTop: 12 }} onClick={() => setShowUpload(true)}>{"\u{1F4E4}"} Subir tu primera factura</Btn>
    </Card>}
    {filtered.length === 0 && invoices.length > 0 && <Card style={{ textAlign: "center", padding: 28 }}>
      <div style={{ fontSize: 32, opacity: 0.2 }}>{"\u{1F50D}"}</div>
      <div style={{ fontSize: 13, color: "#8b8b9e", marginTop: 4 }}>No se encontraron facturas con estos filtros</div>
      <Btn variant="secondary" size="sm" style={{ marginTop: 12 }} onClick={clearAllFilters}>Limpiar filtros</Btn>
    </Card>}
  </div>;
}
