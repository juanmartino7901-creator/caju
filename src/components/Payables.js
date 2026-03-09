"use client";
import { useState, useMemo, useEffect } from "react";
import { fmt, fmtDate as fmtDateShort, STATUSES, BANK_CODES } from "@/lib/utils";
import { generateItauPaymentFile } from "@/lib/itau-format";
import { Card, Btn, Input, Select, Badge, DueBadge, Pagination, PAGE_SIZE } from "@/components/SharedUI";

const fmtDate = fmtDateShort;
const getSup = (suppliers, id) => suppliers.find(s => s.id === id) || {};

export default function Payables({ invoices, suppliers, recurring, onUpdate, sel, setSel, notify, mobile }) {
  const [showHistory, setShowHistory] = useState(false);
  const [paySearch, setPaySearch] = useState("");
  const [payFilterSupplier, setPayFilterSupplier] = useState("ALL");
  const [payFilterDateFrom, setPayFilterDateFrom] = useState("");
  const [payFilterDateTo, setPayFilterDateTo] = useState("");
  const [payFilterAmountMin, setPayFilterAmountMin] = useState("");
  const [payFilterAmountMax, setPayFilterAmountMax] = useState("");
  const [showPayFilters, setShowPayFilters] = useState(false);
  const [payPage, setPayPage] = useState(1);
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");

  const allPayable = invoices.filter(i => ["APPROVED", "SCHEDULED"].includes(i.status)).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  const payable = useMemo(() => {
    let list = allPayable;
    if (paySearch) {
      const t = paySearch.toLowerCase();
      list = list.filter(i => {
        const s = getSup(suppliers, i.supplier_id);
        const matchText = s.name?.toLowerCase().includes(t) || s.alias?.toLowerCase().includes(t) || i.invoice_number.toLowerCase().includes(t);
        const matchAmount = !isNaN(t.replace(/[$.,\s]/g, "")) && t.replace(/[$.,\s]/g, "").length > 0 && String(i.total).includes(t.replace(/[$.,\s]/g, ""));
        return matchText || matchAmount;
      });
    }
    if (payFilterSupplier !== "ALL") list = list.filter(i => i.supplier_id === payFilterSupplier);
    if (payFilterDateFrom) list = list.filter(i => i.due_date >= payFilterDateFrom);
    if (payFilterDateTo) list = list.filter(i => i.due_date <= payFilterDateTo);
    if (payFilterAmountMin) list = list.filter(i => i.total >= Number(payFilterAmountMin));
    if (payFilterAmountMax) list = list.filter(i => i.total <= Number(payFilterAmountMax));
    return list;
  }, [allPayable, paySearch, payFilterSupplier, payFilterDateFrom, payFilterDateTo, payFilterAmountMin, payFilterAmountMax, suppliers]);

  const pagedPayable = useMemo(() => payable.slice((payPage - 1) * PAGE_SIZE, payPage * PAGE_SIZE), [payable, payPage]);
  useEffect(() => { setPayPage(1); }, [paySearch, payFilterSupplier, payFilterDateFrom, payFilterDateTo, payFilterAmountMin, payFilterAmountMax]);

  const paidInvoices = invoices.filter(i => i.status === "PAID").sort((a, b) => new Date(b.payment_date || b.created_at) - new Date(a.payment_date || a.created_at));
  const reportPaid = useMemo(() => {
    let list = paidInvoices;
    if (reportFrom) list = list.filter(i => (i.payment_date || i.created_at?.split("T")[0] || "") >= reportFrom);
    if (reportTo) list = list.filter(i => (i.payment_date || i.created_at?.split("T")[0] || "") <= reportTo);
    return list;
  }, [paidInvoices, reportFrom, reportTo]);
  const totalPay = payable.reduce((s, i) => s + i.total, 0);
  const totalPaid = paidInvoices.reduce((s, i) => s + i.total, 0);
  const monthlyFixed = recurring.filter(r => r.active).reduce((s, r) => s + r.amount, 0);
  const selTotal = payable.filter(i => sel.has(i.id)).reduce((s, i) => s + i.total, 0);
  const toggle = id => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const hasPayFilters = paySearch || payFilterSupplier !== "ALL" || payFilterDateFrom || payFilterDateTo || payFilterAmountMin || payFilterAmountMax;

  const paidByMonth = useMemo(() => {
    const groups = {};
    paidInvoices.forEach(inv => {
      const d = inv.payment_date || inv.created_at?.split("T")[0] || "Sin fecha";
      const key = d.slice(0, 7);
      if (!groups[key]) groups[key] = { invoices: [], total: 0 };
      groups[key].invoices.push(inv);
      groups[key].total += inv.total;
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [paidInvoices]);

  const generateExcel = async () => {
    const selected = sel.size > 0 ? payable.filter(i => sel.has(i.id)) : payable;
    if (selected.length === 0) { notify("No hay facturas para exportar", "error"); return; }

    if (!window.XLSX) {
      const script = document.createElement("script");
      script.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
      document.head.appendChild(script);
      await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = reject; });
    }
    const XLSX = window.XLSX;

    const detailRows = selected.map(inv => {
      const sup = getSup(suppliers, inv.supplier_id);
      return {
        "Proveedor": sup.name || "—", "Alias": sup.alias || "—", "RUT": sup.tax_id || "—",
        "N° Factura": inv.invoice_number, "Emisión": inv.issue_date || "—", "Vencimiento": inv.due_date || "—",
        "Moneda": inv.currency, "Subtotal": inv.subtotal, "IVA": inv.tax_amount, "Total": inv.total,
        "Estado": STATUSES[inv.status]?.label || inv.status, "Banco": sup.bank || "—", "Cuenta": sup.account_number || "—",
      };
    });

    const bySupplier = {};
    selected.forEach(inv => {
      const sup = getSup(suppliers, inv.supplier_id);
      const key = sup.name || "Sin proveedor";
      if (!bySupplier[key]) bySupplier[key] = { proveedor: key, alias: sup.alias || "—", rut: sup.tax_id || "—", facturas: 0, total: 0 };
      bySupplier[key].facturas++;
      bySupplier[key].total += inv.total;
    });
    const summaryRows = Object.values(bySupplier).sort((a, b) => b.total - a.total).map(s => ({
      "Proveedor": s.proveedor, "Alias": s.alias, "RUT": s.rut, "Facturas": s.facturas, "Total": s.total,
    }));
    summaryRows.push({ "Proveedor": "TOTAL", "Alias": "", "RUT": "", "Facturas": selected.length, "Total": selected.reduce((s, i) => s + i.total, 0) });

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(detailRows);
    const ws2 = XLSX.utils.json_to_sheet(summaryRows);
    ws1["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 14 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    ws2["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 14 }, { wch: 10 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Detalle");
    XLSX.utils.book_append_sheet(wb, ws2, "Resumen");

    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
    XLSX.writeFile(wb, `pagos_${today}.xlsx`);
    notify(`📊 Excel generado: ${selected.length} facturas`);
  };

  const generateItauTxt = () => {
    if (sel.size === 0) { notify("Seleccioná facturas", "error"); return; }

    const DEBIT_ACCOUNT = process.env.NEXT_PUBLIC_ITAU_DEBIT_ACCOUNT || "1234567";
    const OFFICE_CODE = process.env.NEXT_PUBLIC_ITAU_OFFICE_CODE || "04";

    const selected = payable.filter(i => sel.has(i.id));
    const errors = [];
    const payments = [];
    selected.forEach(inv => {
      const sup = getSup(suppliers, inv.supplier_id);
      if (!sup.account_number || sup.account_number === "—") { errors.push(`${sup.alias || sup.name}: sin cuenta bancaria`); return; }
      if (!sup.bank || sup.bank === "—") { errors.push(`${sup.alias || sup.name}: sin banco asignado`); return; }
      if (!BANK_CODES[sup.bank]) { errors.push(`${sup.alias || sup.name}: banco "${sup.bank}" no reconocido`); return; }
      payments.push({
        supplier: { bank_code: BANK_CODES[sup.bank], bank_name: sup.bank, account_number: sup.account_number.replace(/\D/g, ""), account_type: sup.account_type, name: sup.name, alias: sup.alias },
        currency: inv.currency || "UYU", amount: inv.total, payment_date: inv.due_date || inv.issue_date, invoice_number: inv.invoice_number || "",
      });
    });

    if (errors.length > 0) {
      notify(`⚠️ ${errors.length} factura(s) sin datos bancarios: ${errors[0]}`, "error");
      if (payments.length === 0) return;
    }

    const { content, filename, summary } = generateItauPaymentFile(payments, DEBIT_ACCOUNT, OFFICE_CODE);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);

    notify(`🏦 Archivo Itaú generado: ${summary.total_payments} pago(s) por ${fmt(selTotal)}${summary.other_bank_transfers > 0 ? ` (${summary.other_bank_transfers} inter-bancario)` : ""}`);
  };

  // ─── Report: build rows from paid invoices ─────────────
  const buildReportRows = () => reportPaid.map(inv => {
    const sup = getSup(suppliers, inv.supplier_id);
    return {
      fecha_pago: inv.payment_date || inv.created_at?.split("T")[0] || "—",
      proveedor: sup.alias || sup.name || "—",
      nro_factura: inv.invoice_number || "—",
      monto: inv.total,
      moneda: inv.currency || "UYU",
      estado: STATUSES[inv.status]?.label || inv.status,
    };
  });

  const reportRangeLabel = () => {
    if (reportFrom && reportTo) return `${reportFrom} a ${reportTo}`;
    if (reportFrom) return `Desde ${reportFrom}`;
    if (reportTo) return `Hasta ${reportTo}`;
    return "Todo el historial";
  };

  const downloadReportExcel = async () => {
    const rows = buildReportRows();
    if (rows.length === 0) { notify("No hay pagos para exportar", "error"); return; }

    if (!window.XLSX) {
      const script = document.createElement("script");
      script.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
      document.head.appendChild(script);
      await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = reject; });
    }
    const XLSX = window.XLSX;

    const sheetRows = rows.map(r => ({
      "Fecha de Pago": r.fecha_pago, "Proveedor": r.proveedor, "N° Factura": r.nro_factura,
      "Monto": r.monto, "Moneda": r.moneda, "Estado": r.estado,
    }));
    sheetRows.push({ "Fecha de Pago": "", "Proveedor": "", "N° Factura": "TOTAL", "Monto": rows.reduce((s, r) => s + r.monto, 0), "Moneda": "", "Estado": "" });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    ws["!cols"] = [{ wch: 14 }, { wch: 25 }, { wch: 18 }, { wch: 14 }, { wch: 8 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, "Reporte Pagos");

    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
    XLSX.writeFile(wb, `reporte_pagos_${today}.xlsx`);
    notify(`📊 Excel generado: ${rows.length} pagos — ${reportRangeLabel()}`);
  };

  const downloadReportPDF = async () => {
    const rows = buildReportRows();
    if (rows.length === 0) { notify("No hay pagos para exportar", "error"); return; }

    if (!window.jspdf) {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js";
      document.head.appendChild(script);
      await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = reject; });
    }
    if (!window.jspdf?.jsPDF?.API?.autoTable) {
      const script2 = document.createElement("script");
      script2.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.4/jspdf.plugin.autotable.min.js";
      document.head.appendChild(script2);
      await new Promise((resolve, reject) => { script2.onload = resolve; script2.onerror = reject; });
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Header
    doc.setFontSize(24);
    doc.setTextColor(232, 93, 4); // #e85d04
    doc.text("Cajú", 14, 20);
    doc.setFontSize(9);
    doc.setTextColor(139, 139, 158);
    doc.text("GESTIÓN DE PAGOS", 14, 26);

    doc.setFontSize(16);
    doc.setTextColor(26, 26, 46);
    doc.text("Reporte de Pagos", 14, 40);

    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(`Período: ${reportRangeLabel()}`, 14, 48);
    doc.text(`Generado: ${new Date().toLocaleDateString("es-UY")}`, 14, 54);
    doc.text(`Total: ${rows.length} pagos`, 14, 60);

    // Separator
    doc.setDrawColor(232, 93, 4);
    doc.setLineWidth(0.5);
    doc.line(14, 64, 196, 64);

    // Table
    const totalAmount = rows.reduce((s, r) => s + r.monto, 0);
    const tableBody = rows.map(r => [r.fecha_pago, r.proveedor, r.nro_factura, fmt(r.monto, r.moneda), r.moneda]);
    tableBody.push(["", "", "TOTAL", fmt(totalAmount), ""]);

    doc.autoTable({
      startY: 68,
      head: [["Fecha Pago", "Proveedor", "N° Factura", "Monto", "Moneda"]],
      body: tableBody,
      theme: "grid",
      headStyles: { fillColor: [26, 26, 46], textColor: [255, 255, 255], fontSize: 9, fontStyle: "bold" },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [247, 247, 250] },
      footStyles: { fillColor: [232, 93, 4], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { cellPadding: 3 },
      columnStyles: { 3: { halign: "right" }, 4: { halign: "center" } },
      didParseCell: (data) => {
        if (data.row.index === tableBody.length - 1 && data.section === "body") {
          data.cell.styles.fillColor = [26, 26, 46];
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
    doc.save(`reporte_pagos_${today}.pdf`);
    notify(`📄 PDF generado: ${rows.length} pagos — ${reportRangeLabel()}`);
  };

  return <div style={{ animation: "fadeIn 0.25s ease" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
      <div>
        <h1 style={{ fontSize: mobile ? 20 : 22, fontWeight: 800 }}>Pagos</h1>
        <span style={{ fontSize: 12, color: "#8b8b9e", fontWeight: 500 }}>{hasPayFilters ? `${payable.length} resultados` : `${allPayable.length} facturas por pagar`}</span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <Btn variant="secondary" size="sm" onClick={generateExcel}>📊 Excel</Btn>
        <Btn size="sm" onClick={generateItauTxt}>🏦 Itaú</Btn>
      </div>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
      <Card style={{ padding: 12 }}><div style={{ fontSize: 10, color: "#8b8b9e", fontWeight: 600, textTransform: "uppercase" }}>Por Pagar</div><div style={{ fontSize: mobile ? 16 : 20, fontWeight: 800, marginTop: 3 }}>{fmt(totalPay)}</div><div style={{ fontSize: 10, color: "#8b8b9e" }}>{payable.length} facturas</div></Card>
      <Card style={{ padding: 12 }}><div style={{ fontSize: 10, color: "#8b8b9e", fontWeight: 600, textTransform: "uppercase" }}>Fijos Mes</div><div style={{ fontSize: mobile ? 16 : 20, fontWeight: 800, marginTop: 3 }}>{fmt(monthlyFixed)}</div></Card>
      <Card style={{ padding: 12 }}><div style={{ fontSize: 10, color: "#8b8b9e", fontWeight: 600, textTransform: "uppercase" }}>Total Mes</div><div style={{ fontSize: mobile ? 16 : 20, fontWeight: 800, marginTop: 3, color: "#e85d04" }}>{fmt(totalPay + monthlyFixed)}</div></Card>
      <Card style={{ padding: 12, cursor: "pointer", border: showHistory ? "1px solid #059669" : undefined }} onClick={() => setShowHistory(!showHistory)}><div style={{ fontSize: 10, color: "#059669", fontWeight: 600, textTransform: "uppercase" }}>Pagado ✓</div><div style={{ fontSize: mobile ? 16 : 20, fontWeight: 800, marginTop: 3, color: "#059669" }}>{fmt(totalPaid)}</div><div style={{ fontSize: 10, color: "#8b8b9e" }}>{paidInvoices.length} facturas</div></Card>
      {sel.size > 0 && <Card style={{ padding: 12, border: "1px solid #e85d04" }}><div style={{ fontSize: 10, color: "#e85d04", fontWeight: 600, textTransform: "uppercase" }}>Selección</div><div style={{ fontSize: mobile ? 16 : 20, fontWeight: 800, marginTop: 3 }}>{fmt(selTotal)}</div></Card>}
    </div>

    <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
      <input type="text" placeholder="🔍  Buscar proveedor, número, monto..." value={paySearch} onChange={e => setPaySearch(e.target.value)} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #e0e0e6", fontSize: 14, outline: "none" }} />
      <button onClick={() => setShowPayFilters(!showPayFilters)} style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${showPayFilters || hasPayFilters ? "#e85d04" : "#e0e0e6"}`, background: showPayFilters ? "#fff8f3" : "#fff", color: showPayFilters || hasPayFilters ? "#e85d04" : "#6b7280", fontSize: 14, cursor: "pointer", flexShrink: 0, fontWeight: 600 }} title="Filtros avanzados">
        ⚙ {hasPayFilters && payFilterSupplier !== "ALL" || payFilterDateFrom || payFilterDateTo || payFilterAmountMin || payFilterAmountMax ? "●" : ""}
      </button>
    </div>

    {showPayFilters && <Card style={{ marginBottom: 8, padding: 12, border: "1px solid #e0e0e6" }}>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr 1fr 1fr", gap: 8, alignItems: "end" }}>
        <Select label="Proveedor" value={payFilterSupplier} onChange={e => setPayFilterSupplier(e.target.value)}>
          <option value="ALL">Todos</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.alias || s.name}</option>)}
        </Select>
        <Input label="Fecha desde" type="date" value={payFilterDateFrom} onChange={e => setPayFilterDateFrom(e.target.value)} />
        <Input label="Fecha hasta" type="date" value={payFilterDateTo} onChange={e => setPayFilterDateTo(e.target.value)} />
        <Input label="Monto mín" type="number" value={payFilterAmountMin} onChange={e => setPayFilterAmountMin(e.target.value)} placeholder="0" />
        <Input label="Monto máx" type="number" value={payFilterAmountMax} onChange={e => setPayFilterAmountMax(e.target.value)} placeholder="999999" />
      </div>
      {hasPayFilters && <div style={{ marginTop: 8, textAlign: "right" }}>
        <Btn variant="ghost" size="sm" onClick={() => { setPaySearch(""); setPayFilterSupplier("ALL"); setPayFilterDateFrom(""); setPayFilterDateTo(""); setPayFilterAmountMin(""); setPayFilterAmountMax(""); }}>Limpiar filtros</Btn>
      </div>}
    </Card>}

    <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
      <Btn variant="secondary" size="sm" onClick={() => setSel(sel.size === payable.length ? new Set() : new Set(payable.map(i => i.id)))}>{sel.size === payable.length ? "Deseleccionar" : "Seleccionar todo"}</Btn>
      {sel.size > 0 && <Btn variant="success" size="sm" onClick={() => { if (!confirm(`¿Marcar ${sel.size} factura(s) como pagadas?`)) return; sel.forEach(id => onUpdate(id, { status: "PAID" })); setSel(new Set()); }}>💰 Pagar {sel.size}</Btn>}
    </div>

    <Pagination page={payPage} setPage={setPayPage} totalItems={payable.length} label="por pagar" />

    {pagedPayable.map(inv => {
      const sup = getSup(suppliers, inv.supplier_id);
      const checked = sel.has(inv.id);
      return <Card key={inv.id} onClick={() => toggle(inv.id)} style={{ padding: "10px 12px", marginBottom: 5, borderLeft: checked ? "3px solid #e85d04" : "3px solid transparent", background: checked ? "#fff8f3" : "#fff", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="checkbox" checked={checked} readOnly style={{ accentColor: "#e85d04", width: 18, height: 18, flexShrink: 0, cursor: "pointer" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{sup.alias}</div>
                <div style={{ fontSize: 11, color: "#8b8b9e" }}>{!mobile && <>{sup.bank} · {sup.account_type} {sup.account_number} · </>}{inv.invoice_number}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{fmt(inv.total, inv.currency)}</div>
                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", marginTop: 2 }}><DueBadge d={inv.due_date} /><Badge status={inv.status} /></div>
              </div>
            </div>
          </div>
        </div>
      </Card>;
    })}
    {payable.length > PAGE_SIZE && <Pagination page={payPage} setPage={setPayPage} totalItems={payable.length} label="por pagar" />}
    {payable.length === 0 && !showHistory && <Card style={{ textAlign: "center", padding: 28 }}><div style={{ fontSize: 32, opacity: 0.2 }}>✅</div><div style={{ fontSize: 13, color: "#8b8b9e", marginTop: 4 }}>{hasPayFilters ? "No se encontraron facturas con estos filtros" : "Sin pagos pendientes"}</div>{hasPayFilters && <Btn variant="secondary" size="sm" style={{ marginTop: 8 }} onClick={() => { setPaySearch(""); setPayFilterSupplier("ALL"); setPayFilterDateFrom(""); setPayFilterDateTo(""); setPayFilterAmountMin(""); setPayFilterAmountMax(""); }}>Limpiar filtros</Btn>}</Card>}

    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, cursor: "pointer" }} onClick={() => setShowHistory(!showHistory)}>
          {showHistory ? "▾" : "▸"} Historial de Pagos
          <span style={{ fontSize: 12, fontWeight: 500, color: "#8b8b9e", marginLeft: 6 }}>({paidInvoices.length})</span>
        </h2>
        {showHistory && paidInvoices.length > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>Total: {fmt(totalPaid)}</span>}
      </div>

      {showHistory && paidInvoices.length > 0 && <Card style={{ marginBottom: 12, padding: 12, border: "1px solid #d1fae5", background: "#f9fefb" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
          <Input label="Desde" type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)} style={{ maxWidth: 160 }} />
          <Input label="Hasta" type="date" value={reportTo} onChange={e => setReportTo(e.target.value)} style={{ maxWidth: 160 }} />
          <div style={{ display: "flex", gap: 6, alignItems: "center", paddingBottom: 1 }}>
            <Btn variant="secondary" size="sm" onClick={downloadReportExcel}>📊 Excel</Btn>
            <Btn variant="secondary" size="sm" onClick={downloadReportPDF}>📄 PDF</Btn>
            {(reportFrom || reportTo) && <Btn variant="ghost" size="sm" onClick={() => { setReportFrom(""); setReportTo(""); }}>Limpiar</Btn>}
          </div>
          <span style={{ fontSize: 11, color: "#8b8b9e", paddingBottom: 4 }}>{reportPaid.length} pago(s) — {fmt(reportPaid.reduce((s, i) => s + i.total, 0))}</span>
        </div>
      </Card>}

      {showHistory && paidByMonth.map(([month, group]) => {
        const monthLabel = new Date(month + "-15").toLocaleDateString("es-UY", { month: "long", year: "numeric" }).replace(/^\w/, c => c.toUpperCase());
        return <div key={month} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, padding: "4px 0", borderBottom: "2px solid #d1fae5" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>{monthLabel}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#059669" }}>{fmt(group.total)}</span>
          </div>
          {group.invoices.map(inv => {
            const sup = getSup(suppliers, inv.supplier_id);
            return <Card key={inv.id} style={{ padding: "8px 12px", marginBottom: 4, background: "#f9fefb", borderLeft: "3px solid #a7f3d0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{sup.alias || sup.name || "—"}</span>
                    <span style={{ fontSize: 10, color: "#059669", fontWeight: 600, padding: "1px 5px", background: "#d1fae5", borderRadius: 4 }}>💰 Pagada</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 3, fontSize: 11, color: "#8b8b9e" }}>
                    <span>{inv.invoice_number}</span>
                    <span>Emitida: {fmtDate(inv.issue_date)}</span>
                    {inv.payment_date && <span>Pagada: {fmtDate(inv.payment_date)}</span>}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#059669" }}>{fmt(inv.total, inv.currency)}</div>
                  {sup.bank && sup.bank !== "—" && <div style={{ fontSize: 10, color: "#8b8b9e" }}>{sup.bank} · {sup.account_number}</div>}
                </div>
              </div>
            </Card>;
          })}
        </div>;
      })}

      {showHistory && paidInvoices.length === 0 && <Card style={{ textAlign: "center", padding: 20 }}><div style={{ fontSize: 12, color: "#8b8b9e" }}>No hay pagos registrados aún</div></Card>}
    </div>
  </div>;
}
