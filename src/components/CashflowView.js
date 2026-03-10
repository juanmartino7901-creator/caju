"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Card, Btn, Input, Select } from "@/components/SharedUI";
import { projectCashFlows, computeNPV, findBreakEvenMonth, findPeakDeficit, getAnnualSummary, getMonthlyExchangeRate } from "@/lib/cashflow-engine";
import { formatCurrency, formatPercent, getMonthLabel } from "@/lib/cashflow-format";
import { DEFAULT_PAYMENT_TERMS } from "@/lib/cashflow-types";
import { SAMPLE_PROJECT } from "@/lib/sample-data";
import { BarChart, Bar, AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine } from "recharts";

const TABS = [
  { key: "resumen", label: "Resumen", icon: "📊" },
  { key: "ingresos", label: "Ingresos", icon: "💰" },
  { key: "costos", label: "Costos", icon: "📉" },
  { key: "financiamiento", label: "Financiam.", icon: "🏦" },
  { key: "sensibilidad", label: "Sensibilidad", icon: "🎛️" },
];

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ─── Custom Tooltip ──────────────────────────────────
const CTooltip = ({ active, payload, label, currency }) => {
  if (!active || !payload?.length) return null;
  return <div style={{ background: "#fff", border: "1px solid #e8e8ec", borderRadius: 8, padding: "8px 12px", fontSize: 11, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
    <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
    {payload.map((p, i) => <div key={i} style={{ color: p.color, fontWeight: 500 }}>{p.name}: {formatCurrency(p.value, false, currency)}</div>)}
  </div>;
};

// ─── KPI Card ────────────────────────────────────────
const KPI = ({ label, value, sub, color }) => (
  <Card style={{ textAlign: "center", padding: "12px 8px" }}>
    <div style={{ fontSize: 10, color: "#8b8b9e", fontWeight: 600, marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 800, color: color || "#1a1a2e" }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: "#8b8b9e", marginTop: 2 }}>{sub}</div>}
  </Card>
);

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function CashflowView({ supabase, mobile, notify }) {
  const [tab, setTab] = useState("resumen");
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [data, setData] = useState(null); // ProjectData
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dbAvailable, setDbAvailable] = useState(true);

  // ─── API helper ────────────────────────────────────────
  const apiCall = useCallback(async (method, body) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const opts = { method, headers: { Authorization: `Bearer ${session?.access_token}` } };
      if (body) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
      const res = await fetch("/api/cashflow" + (method === "DELETE" && body?.id ? `?id=${body.id}` : ""), opts);
      const json = await res.json();
      if (json.success) return json;
      return null;
    } catch { return null; }
  }, [supabase]);

  // ─── Fetch projects ──────────────────────────────────
  const fetchProjects = useCallback(async () => {
    const json = await apiCall("GET");
    if (json) {
      setProjects(json.data || []);
      return json.data || [];
    }
    setDbAvailable(false);
    return [];
  }, [apiCall]);

  // ─── Load full project ────────────────────────────────
  const loadProject = useCallback(async (id) => {
    try {
      const { data: proj, error } = await supabase
        .from("cashflow_projects")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      setActiveProject(proj);
      setData(proj.data);
    } catch (err) {
      console.error("Cajú: Error loading project", err);
    }
  }, [supabase]);

  // ─── Create project (DB or local) ─────────────────────
  const createProjectWithData = useCallback(async (projectData) => {
    const json = await apiCall("POST", { name: projectData.setup.name, data: projectData });
    if (json?.data) {
      setActiveProject(json.data);
      setData(projectData);
      await fetchProjects();
      return json.data;
    }
    // Fallback: local-only project
    const localProj = { id: `local-${uid()}`, name: projectData.setup.name, data: projectData, created_at: new Date().toISOString() };
    setActiveProject(localProj);
    setData(projectData);
    setProjects(prev => [...prev, localProj]);
    setDbAvailable(false);
    return localProj;
  }, [apiCall, fetchProjects]);

  // ─── Init ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      let list = await fetchProjects();
      if (list.length === 0) {
        // Auto-create sample project
        await createProjectWithData(SAMPLE_PROJECT);
      } else {
        await loadProject(list[0].id);
      }
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Save project data ────────────────────────────────
  // Immediate local state update + debounced DB persistence
  const saveTimerRef = useRef(null);
  const saveData = useCallback((newData) => {
    // Synchronous state update — triggers re-render + recalc immediately
    setData(newData);
    // Debounced DB save (500ms) to avoid hammering API on every keystroke
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      if (!activeProject) return;
      if (dbAvailable && !activeProject.id?.startsWith("local-")) {
        setSaving(true);
        await apiCall("PUT", { id: activeProject.id, name: newData.setup?.name || activeProject.name, data: newData });
        setSaving(false);
      }
    }, 500);
  }, [activeProject, dbAvailable, apiCall]);

  // ─── Create new project ────────────────────────────────
  const createProject = useCallback(async () => {
    const blank = {
      setup: { name: "Nuevo Proyecto", currency: "UYU", startDate: new Date().toISOString().slice(0, 7), horizonMonths: 36, discountRate: 10, inflationRates: [8, 7, 6] },
      revenueStreams: [], variableCosts: [], fixedCosts: [], employees: [], capexItems: [], loans: [],
      initialCash: 0, taxAssumptions: { incomeTaxRate: 25, vatRate: 22, payrollTaxRate: 0 },
    };
    await createProjectWithData(blank);
    notify?.("Proyecto creado");
  }, [createProjectWithData, notify]);

  // ─── Delete project ────────────────────────────────────
  const deleteProject = useCallback(async (id) => {
    if (!confirm("¿Eliminar este proyecto de cashflow?")) return;
    if (dbAvailable && !id.startsWith("local-")) {
      await apiCall("DELETE", { id });
    }
    const remaining = projects.filter(p => p.id !== id);
    setProjects(remaining);
    if (remaining.length > 0) {
      if (dbAvailable && !remaining[0].id?.startsWith("local-")) {
        await loadProject(remaining[0].id);
      } else {
        setActiveProject(remaining[0]);
        setData(remaining[0].data);
      }
    } else {
      setActiveProject(null);
      setData(null);
    }
    notify?.("Proyecto eliminado");
  }, [dbAvailable, apiCall, projects, loadProject, notify]);

  // ─── Compute projections ──────────────────────────────
  const projections = useMemo(() => {
    if (!data) return [];
    try { return projectCashFlows(data); } catch { return []; }
  }, [data]);

  const annualData = useMemo(() => {
    if (!projections.length) return [];
    try { return getAnnualSummary(projections); } catch { return []; }
  }, [projections]);

  const kpis = useMemo(() => {
    if (!projections.length || !data) return {};
    try {
      const last = projections[projections.length - 1];
      const totalRev = projections.reduce((s, p) => s + p.totalRevenue, 0);
      const npv = computeNPV(projections, data.setup.discountRate);
      const peak = findPeakDeficit(projections);
      const breakEven = findBreakEvenMonth(projections);
      return { totalRev, finalCash: last.closingCash, npv, peak, breakEven };
    } catch { return {}; }
  }, [projections, data]);

  const currency = data?.setup?.currency || "UYU";

  // ─── Switch project ─────────────────────────────────────
  const switchProject = useCallback(async (id) => {
    const proj = projects.find(p => p.id === id);
    if (!proj) return;
    if (dbAvailable && !id.startsWith("local-")) {
      await loadProject(id);
    } else if (proj.data) {
      setActiveProject(proj);
      setData(proj.data);
    }
  }, [projects, dbAvailable, loadProject]);

  // ─── Shared JSX pieces ────────────────────────────────
  const projectBar = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
      {projects.length > 0 && <Select value={activeProject?.id || ""} onChange={(e) => switchProject(e.target.value)} style={{ maxWidth: 260, fontSize: 13 }}>
        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </Select>}
      <Btn size="sm" onClick={createProject}>+ Nuevo</Btn>
      {activeProject && <Btn variant="danger" size="sm" onClick={() => deleteProject(activeProject.id)}>🗑</Btn>}
      {saving && <span style={{ fontSize: 11, color: "#8b8b9e" }}>Guardando...</span>}
      {!dbAvailable && <span style={{ fontSize: 10, color: "#d97706", fontWeight: 500 }}>⚠ Modo local (ejecutá la migración SQL)</span>}
    </div>
  );

  const tabBar = (
    <div style={{ display: "flex", gap: 2, marginBottom: 14, overflowX: "auto", paddingBottom: 2 }}>
      {TABS.map(t => (
        <button key={t.key} onClick={() => setTab(t.key)} style={{
          padding: mobile ? "6px 10px" : "7px 14px", borderRadius: 8, cursor: "pointer",
          background: tab === t.key ? "#e85d04" : "#fff", color: tab === t.key ? "#fff" : "#8b8b9e",
          fontSize: mobile ? 11 : 12, fontWeight: 600, whiteSpace: "nowrap", transition: "all 0.15s",
          border: tab === t.key ? "none" : "1px solid #e8e8ec",
        }}>
          {t.icon} {t.label}
        </button>
      ))}
    </div>
  );

  // ─── Early returns (all hooks already called above) ───
  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#8b8b9e" }}>Cargando proyecciones...</div>;

  if (!data) return <div style={{ animation: "fadeIn 0.25s ease" }}>
    <h1 style={{ fontSize: mobile ? 20 : 22, fontWeight: 800, marginBottom: 12 }}>Cashflow</h1>
    {projectBar}
    <Card style={{ textAlign: "center", padding: 40 }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>📈</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Sin proyectos</div>
      <Btn onClick={createProject}>+ Crear Proyecto</Btn>
    </Card>
  </div>;

  // ─── Main render ───────────────────────────────────────
  return <div style={{ animation: "fadeIn 0.25s ease" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <h1 style={{ fontSize: mobile ? 20 : 22, fontWeight: 800 }}>Cashflow</h1>
    </div>
    {projectBar}
    {tabBar}

    {tab === "resumen" && <ResumenTab projections={projections} annualData={annualData} kpis={kpis} currency={currency} data={data} mobile={mobile} />}
    {tab === "ingresos" && <IngresosTab data={data} saveData={saveData} projections={projections} currency={currency} mobile={mobile} />}
    {tab === "costos" && <CostosTab data={data} saveData={saveData} currency={currency} mobile={mobile} />}
    {tab === "financiamiento" && <FinanciamientoTab data={data} saveData={saveData} currency={currency} mobile={mobile} />}
    {tab === "sensibilidad" && <SensibilidadTab data={data} currency={currency} mobile={mobile} />}
  </div>;
}

// ============================================================
// TAB: RESUMEN
// ============================================================
function ResumenTab({ projections, annualData, kpis, currency, data, mobile }) {
  if (!projections.length) return <Card><div style={{ textAlign: "center", color: "#8b8b9e", padding: 20 }}>Agregá ingresos y costos para ver proyecciones</div></Card>;

  const chartData = projections.map(p => ({
    label: p.label,
    Ingresos: p.totalRevenue,
    Egresos: p.totalVariableCosts + p.totalFixedCosts + p.totalCapex + p.totalLoanPrincipal + p.totalLoanInterest + p.incomeTax,
    "Flujo Neto": p.netCashFlow,
  }));

  const cashData = projections.map(p => ({ label: p.label, Saldo: p.closingCash }));

  const cols = mobile ? "1fr" : "repeat(5, 1fr)";

  return <>
    {/* KPIs */}
    <div style={{ display: "grid", gridTemplateColumns: cols, gap: 8, marginBottom: 14 }}>
      <KPI label="Revenue Total" value={formatCurrency(kpis.totalRev, true, currency)} />
      <KPI label="Cash Final" value={formatCurrency(kpis.finalCash, true, currency)} color={kpis.finalCash >= 0 ? "#059669" : "#dc2626"} />
      <KPI label="VPN" value={formatCurrency(Math.round(kpis.npv), true, currency)} color={kpis.npv >= 0 ? "#059669" : "#dc2626"} />
      <KPI label="Déficit Máximo" value={formatCurrency(kpis.peak, true, currency)} color={kpis.peak < 0 ? "#dc2626" : "#059669"} />
      <KPI label="Break-Even" value={kpis.breakEven ? `Mes ${kpis.breakEven}` : "—"} sub={kpis.breakEven ? getMonthLabel(kpis.breakEven - 1) : "No alcanzado"} />
    </div>

    {/* Revenue vs Costs chart */}
    <Card style={{ marginBottom: 14 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Ingresos vs Egresos (mensual)</h3>
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={Math.max(0, Math.floor(chartData.length / 12) - 1)} />
            <YAxis tick={{ fontSize: 9 }} tickFormatter={v => formatCurrency(v, true)} />
            <Tooltip content={<CTooltip currency={currency} />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Ingresos" fill="#059669" radius={[2, 2, 0, 0]} />
            <Bar dataKey="Egresos" fill="#dc2626" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>

    {/* Cumulative cash chart */}
    <Card style={{ marginBottom: 14 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Saldo Acumulado de Caja</h3>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <AreaChart data={cashData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={Math.max(0, Math.floor(cashData.length / 12) - 1)} />
            <YAxis tick={{ fontSize: 9 }} tickFormatter={v => formatCurrency(v, true)} />
            <Tooltip content={<CTooltip currency={currency} />} />
            <ReferenceLine y={0} stroke="#dc2626" strokeDasharray="3 3" />
            <Area type="monotone" dataKey="Saldo" stroke="#e85d04" fill="#e85d04" fillOpacity={0.15} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>

    {/* Monthly table */}
    <Card>
      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Resumen Anual</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e8e8ec" }}>
              {["Período", "Ingresos", "C.Variables", "C.Fijos", "EBITDA", "CapEx", "Préstamos", "Impuesto", "Flujo Neto", "Caja"].map(h => (
                <th key={h} style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: "#8b8b9e", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {annualData.map((row, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f5f5f8" }}>
                <td style={{ padding: "5px 8px", fontWeight: 600 }}>{row.label}</td>
                <td style={{ padding: "5px 8px", textAlign: "right" }}>{formatCurrency(row.totalRevenue, true, currency)}</td>
                <td style={{ padding: "5px 8px", textAlign: "right", color: "#dc2626" }}>{formatCurrency(row.totalVariableCosts, true, currency)}</td>
                <td style={{ padding: "5px 8px", textAlign: "right", color: "#dc2626" }}>{formatCurrency(row.totalFixedCosts, true, currency)}</td>
                <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 600, color: row.ebitda >= 0 ? "#059669" : "#dc2626" }}>{formatCurrency(row.ebitda, true, currency)}</td>
                <td style={{ padding: "5px 8px", textAlign: "right" }}>{formatCurrency(row.totalCapex, true, currency)}</td>
                <td style={{ padding: "5px 8px", textAlign: "right" }}>{formatCurrency(row.totalLoanPrincipal + row.totalLoanInterest, true, currency)}</td>
                <td style={{ padding: "5px 8px", textAlign: "right" }}>{formatCurrency(row.incomeTax, true, currency)}</td>
                <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700, color: row.netCashFlow >= 0 ? "#059669" : "#dc2626" }}>{formatCurrency(row.netCashFlow, true, currency)}</td>
                <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700 }}>{formatCurrency(row.closingCash, true, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  </>;
}

// ============================================================
// TAB: INGRESOS
// ============================================================
function IngresosTab({ data, saveData, projections, currency, mobile }) {
  const streams = data.revenueStreams || [];
  const years = Math.ceil(data.setup.horizonMonths / 12);

  const addStream = () => {
    const ns = {
      id: uid(), name: "Nueva Fuente", baseMonthlyRevenue: 0, grossMarginPct: 50,
      seasonality: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      annualRealGrowth: Array(years).fill(0), startMonth: 0,
      useProducts: false, products: [], currency: "local",
    };
    saveData({ ...data, revenueStreams: [...streams, ns] });
  };

  const updateStream = (idx, updates) => {
    const ns = streams.map((s, i) => i === idx ? { ...s, ...updates } : s);
    saveData({ ...data, revenueStreams: ns });
  };

  const removeStream = (idx) => {
    saveData({ ...data, revenueStreams: streams.filter((_, i) => i !== idx) });
  };

  // Revenue preview from projections
  const revenuePreview = useMemo(() => {
    if (!projections.length) return [];
    return projections.slice(0, 12).map(p => ({
      label: p.label,
      total: p.totalRevenue,
    }));
  }, [projections]);

  return <>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700 }}>Fuentes de Ingreso ({streams.length})</h3>
      <Btn size="sm" onClick={addStream}>+ Agregar</Btn>
    </div>

    {streams.map((s, idx) => (
      <Card key={s.id} style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</div>
          <Btn variant="danger" size="sm" onClick={() => removeStream(idx)}>✕</Btn>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr 1fr", gap: 8 }}>
          <Input label="Nombre" value={s.name} onChange={e => updateStream(idx, { name: e.target.value })} />
          <Input label="Monto Mensual Base" type="number" value={s.baseMonthlyRevenue} onChange={e => updateStream(idx, { baseMonthlyRevenue: +e.target.value })} />
          <Input label="Margen Bruto (%)" type="number" value={s.grossMarginPct} onChange={e => updateStream(idx, { grossMarginPct: +e.target.value })} />
          <Input label="Mes Inicio" type="number" value={s.startMonth} onChange={e => updateStream(idx, { startMonth: +e.target.value })} />
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#8b8b9e", display: "block", marginBottom: 4 }}>Estacionalidad (12 meses, 1.0 = normal)</label>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {(s.seasonality || []).map((v, mi) => (
              <input key={mi} type="number" step="0.1" value={v} onChange={e => {
                const ns = [...s.seasonality]; ns[mi] = +e.target.value;
                updateStream(idx, { seasonality: ns });
              }} style={{ width: 48, padding: "4px 3px", borderRadius: 6, border: "1px solid #e0e0e6", fontSize: 11, textAlign: "center" }} />
            ))}
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#8b8b9e", display: "block", marginBottom: 4 }}>Crecimiento Real Anual (% por año)</label>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {(s.annualRealGrowth || []).map((v, yi) => (
              <div key={yi} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9, color: "#8b8b9e" }}>A{yi + 1}</div>
                <input type="number" step="1" value={v} onChange={e => {
                  const ng = [...s.annualRealGrowth]; ng[yi] = +e.target.value;
                  updateStream(idx, { annualRealGrowth: ng });
                }} style={{ width: 48, padding: "4px 3px", borderRadius: 6, border: "1px solid #e0e0e6", fontSize: 11, textAlign: "center" }} />
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <Select label="Moneda" value={s.currency || "local"} onChange={e => updateStream(idx, { currency: e.target.value })} style={{ maxWidth: 120 }}>
            <option value="local">Local</option>
            <option value="USD">USD</option>
          </Select>
        </div>
      </Card>
    ))}

    {streams.length === 0 && <Card style={{ textAlign: "center", color: "#8b8b9e", padding: 20 }}>Sin fuentes de ingreso. Hacé clic en "+ Agregar" para crear una.</Card>}

    {/* Revenue preview chart */}
    {revenuePreview.length > 0 && <Card style={{ marginTop: 14 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Preview: Revenue Proyectado (12 meses)</h3>
      <div style={{ width: "100%", height: 200 }}>
        <ResponsiveContainer>
          <BarChart data={revenuePreview}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} tickFormatter={v => formatCurrency(v, true)} />
            <Tooltip content={<CTooltip currency={currency} />} />
            <Bar dataKey="total" fill="#059669" name="Revenue" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>}
  </>;
}

// ============================================================
// TAB: COSTOS
// ============================================================
function CostosTab({ data, saveData, currency, mobile }) {
  const [section, setSection] = useState("variable");
  const years = Math.ceil(data.setup.horizonMonths / 12);

  const sections = [
    { key: "variable", label: "Costos Variables" },
    { key: "fixed", label: "Costos Fijos" },
    { key: "employees", label: "Empleados" },
    { key: "capex", label: "Inversiones (CapEx)" },
  ];

  // ─── Variable Costs ────────────────────────────────────
  const addVC = () => {
    const nvc = { id: uid(), name: "Nuevo Costo Variable", percentOfRevenue: 10 };
    saveData({ ...data, variableCosts: [...(data.variableCosts || []), nvc] });
  };
  const updateVC = (idx, updates) => {
    const nv = (data.variableCosts || []).map((v, i) => i === idx ? { ...v, ...updates } : v);
    saveData({ ...data, variableCosts: nv });
  };
  const removeVC = (idx) => {
    saveData({ ...data, variableCosts: (data.variableCosts || []).filter((_, i) => i !== idx) });
  };

  // ─── Fixed Costs ───────────────────────────────────────
  const addFC = () => {
    const nfc = { id: uid(), name: "Nuevo Costo Fijo", monthlyAmount: 0, startMonth: 0, escalation: "inflation", currency: "local" };
    saveData({ ...data, fixedCosts: [...(data.fixedCosts || []), nfc] });
  };
  const updateFC = (idx, updates) => {
    const nf = (data.fixedCosts || []).map((f, i) => i === idx ? { ...f, ...updates } : f);
    saveData({ ...data, fixedCosts: nf });
  };
  const removeFC = (idx) => {
    saveData({ ...data, fixedCosts: (data.fixedCosts || []).filter((_, i) => i !== idx) });
  };

  // ─── Employees ─────────────────────────────────────────
  const addEmp = () => {
    const ne = { id: uid(), role: "Nuevo Cargo", headcount: 1, monthlySalary: 0, startMonth: 0, socialChargesPct: 25, currency: "local" };
    saveData({ ...data, employees: [...(data.employees || []), ne] });
  };
  const updateEmp = (idx, updates) => {
    const ne = (data.employees || []).map((e, i) => i === idx ? { ...e, ...updates } : e);
    saveData({ ...data, employees: ne });
  };
  const removeEmp = (idx) => {
    saveData({ ...data, employees: (data.employees || []).filter((_, i) => i !== idx) });
  };

  // ─── CapEx ─────────────────────────────────────────────
  const addCapex = () => {
    const nc = { id: uid(), name: "Nueva Inversión", amount: 0, month: 0, currency: "local" };
    saveData({ ...data, capexItems: [...(data.capexItems || []), nc] });
  };
  const updateCapex = (idx, updates) => {
    const nc = (data.capexItems || []).map((c, i) => i === idx ? { ...c, ...updates } : c);
    saveData({ ...data, capexItems: nc });
  };
  const removeCapex = (idx) => {
    saveData({ ...data, capexItems: (data.capexItems || []).filter((_, i) => i !== idx) });
  };

  return <>
    <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
      {sections.map(s => (
        <button key={s.key} onClick={() => setSection(s.key)} style={{
          padding: "5px 10px", borderRadius: 6, border: section === s.key ? "none" : "1px solid #e8e8ec",
          background: section === s.key ? "#1a1a2e" : "#fff", color: section === s.key ? "#fff" : "#8b8b9e",
          fontSize: 11, fontWeight: 600, cursor: "pointer",
        }}>{s.label}</button>
      ))}
    </div>

    {/* Variable Costs */}
    {section === "variable" && <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700 }}>Costos Variables</h3>
        <Btn size="sm" onClick={addVC}>+ Agregar</Btn>
      </div>
      {(data.variableCosts || []).map((vc, idx) => (
        <Card key={vc.id} style={{ marginBottom: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "2fr 1fr 2fr auto", gap: 8, alignItems: "end" }}>
            <Input label="Nombre" value={vc.name} onChange={e => updateVC(idx, { name: e.target.value })} />
            <Input label="% de Revenue" type="number" value={vc.percentOfRevenue} onChange={e => updateVC(idx, { percentOfRevenue: +e.target.value })} />
            <Select label="Ingreso Vinculado" value={vc.linkedRevenueStreamId || ""} onChange={e => updateVC(idx, { linkedRevenueStreamId: e.target.value || undefined })}>
              <option value="">Todos los ingresos</option>
              {(data.revenueStreams || []).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
            <Btn variant="danger" size="sm" onClick={() => removeVC(idx)}>✕</Btn>
          </div>
        </Card>
      ))}
      {(data.variableCosts || []).length === 0 && <Card style={{ textAlign: "center", color: "#8b8b9e", padding: 16, fontSize: 12 }}>Sin costos variables</Card>}
    </>}

    {/* Fixed Costs */}
    {section === "fixed" && <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700 }}>Costos Fijos</h3>
        <Btn size="sm" onClick={addFC}>+ Agregar</Btn>
      </div>
      {(data.fixedCosts || []).map((fc, idx) => (
        <Card key={fc.id} style={{ marginBottom: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "2fr 1fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
            <Input label="Nombre" value={fc.name} onChange={e => updateFC(idx, { name: e.target.value })} />
            <Input label="Mensual" type="number" value={fc.monthlyAmount} onChange={e => updateFC(idx, { monthlyAmount: +e.target.value })} />
            <Input label="Mes Inicio" type="number" value={fc.startMonth} onChange={e => updateFC(idx, { startMonth: +e.target.value })} />
            <Select label="Escalamiento" value={fc.escalation} onChange={e => updateFC(idx, { escalation: e.target.value })}>
              <option value="inflation">Inflación</option>
              <option value="manual">Manual</option>
              <option value="flat">Plano</option>
            </Select>
            <Select label="Moneda" value={fc.currency || "local"} onChange={e => updateFC(idx, { currency: e.target.value })}>
              <option value="local">Local</option>
              <option value="USD">USD</option>
            </Select>
            <Btn variant="danger" size="sm" onClick={() => removeFC(idx)}>✕</Btn>
          </div>
          {fc.escalation === "manual" && <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#8b8b9e", display: "block", marginBottom: 4 }}>Tasas manuales por año (%)</label>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {Array.from({ length: years }, (_, yi) => (
                <div key={yi} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: "#8b8b9e" }}>A{yi + 1}</div>
                  <input type="number" step="1" value={(fc.manualRates || [])[yi] || 0} onChange={e => {
                    const nr = [...(fc.manualRates || Array(years).fill(0))]; nr[yi] = +e.target.value;
                    updateFC(idx, { manualRates: nr });
                  }} style={{ width: 48, padding: "4px 3px", borderRadius: 6, border: "1px solid #e0e0e6", fontSize: 11, textAlign: "center" }} />
                </div>
              ))}
            </div>
          </div>}
        </Card>
      ))}
      {(data.fixedCosts || []).length === 0 && <Card style={{ textAlign: "center", color: "#8b8b9e", padding: 16, fontSize: 12 }}>Sin costos fijos</Card>}
    </>}

    {/* Employees */}
    {section === "employees" && <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700 }}>Empleados</h3>
        <Btn size="sm" onClick={addEmp}>+ Agregar</Btn>
      </div>
      {(data.employees || []).map((emp, idx) => (
        <Card key={emp.id} style={{ marginBottom: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "2fr 1fr 1fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
            <Input label="Cargo" value={emp.role} onChange={e => updateEmp(idx, { role: e.target.value })} />
            <Input label="Cantidad" type="number" value={emp.headcount} onChange={e => updateEmp(idx, { headcount: +e.target.value })} />
            <Input label="Salario" type="number" value={emp.monthlySalary} onChange={e => updateEmp(idx, { monthlySalary: +e.target.value })} />
            <Input label="Cargas %" type="number" value={emp.socialChargesPct} onChange={e => updateEmp(idx, { socialChargesPct: +e.target.value })} />
            <Input label="Mes Inicio" type="number" value={emp.startMonth} onChange={e => updateEmp(idx, { startMonth: +e.target.value })} />
            <Select label="Moneda" value={emp.currency || "local"} onChange={e => updateEmp(idx, { currency: e.target.value })}>
              <option value="local">Local</option>
              <option value="USD">USD</option>
            </Select>
            <Btn variant="danger" size="sm" onClick={() => removeEmp(idx)}>✕</Btn>
          </div>
        </Card>
      ))}
      {(data.employees || []).length === 0 && <Card style={{ textAlign: "center", color: "#8b8b9e", padding: 16, fontSize: 12 }}>Sin empleados</Card>}
    </>}

    {/* CapEx */}
    {section === "capex" && <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700 }}>Inversiones (CapEx)</h3>
        <Btn size="sm" onClick={addCapex}>+ Agregar</Btn>
      </div>
      {(data.capexItems || []).map((ci, idx) => (
        <Card key={ci.id} style={{ marginBottom: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "2fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
            <Input label="Nombre" value={ci.name} onChange={e => updateCapex(idx, { name: e.target.value })} />
            <Input label="Monto" type="number" value={ci.amount} onChange={e => updateCapex(idx, { amount: +e.target.value })} />
            <Input label="Mes #" type="number" value={ci.month} onChange={e => updateCapex(idx, { month: +e.target.value })} />
            <Select label="Moneda" value={ci.currency || "local"} onChange={e => updateCapex(idx, { currency: e.target.value })}>
              <option value="local">Local</option>
              <option value="USD">USD</option>
            </Select>
            <Btn variant="danger" size="sm" onClick={() => removeCapex(idx)}>✕</Btn>
          </div>
        </Card>
      ))}
      {(data.capexItems || []).length === 0 && <Card style={{ textAlign: "center", color: "#8b8b9e", padding: 16, fontSize: 12 }}>Sin inversiones</Card>}
    </>}
  </>;
}

// ============================================================
// TAB: FINANCIAMIENTO
// ============================================================
function FinanciamientoTab({ data, saveData, currency, mobile }) {
  const loans = data.loans || [];

  const addLoan = () => {
    const nl = { id: uid(), name: "Nuevo Préstamo", principal: 0, annualRate: 10, firstPaymentMonth: 1, frequency: "monthly", installments: 12, graceMonths: 0 };
    saveData({ ...data, loans: [...loans, nl] });
  };
  const updateLoan = (idx, updates) => {
    const nl = loans.map((l, i) => i === idx ? { ...l, ...updates } : l);
    saveData({ ...data, loans: nl });
  };
  const removeLoan = (idx) => {
    saveData({ ...data, loans: loans.filter((_, i) => i !== idx) });
  };

  // Setup fields
  const updateSetup = (updates) => saveData({ ...data, setup: { ...data.setup, ...updates } });
  const updateTax = (updates) => saveData({ ...data, taxAssumptions: { ...data.taxAssumptions, ...updates } });

  const years = Math.ceil(data.setup.horizonMonths / 12);

  return <>
    {/* Project setup */}
    <Card style={{ marginBottom: 12 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Configuración del Proyecto</h3>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr 1fr", gap: 8 }}>
        <Input label="Nombre" value={data.setup.name} onChange={e => updateSetup({ name: e.target.value })} />
        <Select label="Moneda" value={data.setup.currency} onChange={e => updateSetup({ currency: e.target.value })}>
          <option>UYU</option><option>USD</option>
        </Select>
        <Input label="Inicio (YYYY-MM)" value={data.setup.startDate} onChange={e => updateSetup({ startDate: e.target.value })} />
        <Input label="Horizonte (meses)" type="number" value={data.setup.horizonMonths} onChange={e => updateSetup({ horizonMonths: +e.target.value })} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
        <Input label="Tasa Descuento (% anual)" type="number" value={data.setup.discountRate} onChange={e => updateSetup({ discountRate: +e.target.value })} />
        <Input label="Caja Inicial" type="number" value={data.initialCash} onChange={e => saveData({ ...data, initialCash: +e.target.value })} />
        <Input label="Tipo de Cambio (USD→Local)" type="number" value={data.setup.exchangeRate || ""} onChange={e => updateSetup({ exchangeRate: +e.target.value || undefined })} />
      </div>
      <div style={{ marginTop: 8 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "#8b8b9e", display: "block", marginBottom: 4 }}>Inflación Anual (% por año)</label>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {Array.from({ length: years }, (_, yi) => (
            <div key={yi} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#8b8b9e" }}>A{yi + 1}</div>
              <input type="number" step="0.5" value={(data.setup.inflationRates || [])[yi] || 0} onChange={e => {
                const nr = [...(data.setup.inflationRates || Array(years).fill(0))];
                nr[yi] = +e.target.value;
                updateSetup({ inflationRates: nr });
              }} style={{ width: 48, padding: "4px 3px", borderRadius: 6, border: "1px solid #e0e0e6", fontSize: 11, textAlign: "center" }} />
            </div>
          ))}
        </div>
      </div>
    </Card>

    {/* Tax assumptions */}
    <Card style={{ marginBottom: 12 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Impuestos</h3>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: 8 }}>
        <Input label="Imp. Renta (%)" type="number" value={data.taxAssumptions.incomeTaxRate} onChange={e => updateTax({ incomeTaxRate: +e.target.value })} />
        <Input label="IVA (%)" type="number" value={data.taxAssumptions.vatRate} onChange={e => updateTax({ vatRate: +e.target.value })} />
        <Input label="Imp. Nómina (%)" type="number" value={data.taxAssumptions.payrollTaxRate} onChange={e => updateTax({ payrollTaxRate: +e.target.value })} />
      </div>
    </Card>

    {/* Loans */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700 }}>Préstamos ({loans.length})</h3>
      <Btn size="sm" onClick={addLoan}>+ Agregar</Btn>
    </div>

    {loans.map((loan, idx) => (
      <Card key={loan.id} style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{loan.name}</div>
          <Btn variant="danger" size="sm" onClick={() => removeLoan(idx)}>✕</Btn>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr 1fr", gap: 8 }}>
          <Input label="Nombre" value={loan.name} onChange={e => updateLoan(idx, { name: e.target.value })} />
          <Input label="Capital" type="number" value={loan.principal} onChange={e => updateLoan(idx, { principal: +e.target.value })} />
          <Input label="Tasa Anual (%)" type="number" step="0.1" value={loan.annualRate} onChange={e => updateLoan(idx, { annualRate: +e.target.value })} />
          <Input label="Mes 1er Pago" type="number" value={loan.firstPaymentMonth} onChange={e => updateLoan(idx, { firstPaymentMonth: +e.target.value })} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
          <Select label="Frecuencia" value={loan.frequency} onChange={e => updateLoan(idx, { frequency: e.target.value })}>
            <option value="monthly">Mensual</option>
            <option value="quarterly">Trimestral</option>
            <option value="annual">Anual</option>
          </Select>
          <Input label="# Cuotas" type="number" value={loan.installments} onChange={e => updateLoan(idx, { installments: +e.target.value })} />
          <Input label="Gracia (meses)" type="number" value={loan.graceMonths} onChange={e => updateLoan(idx, { graceMonths: +e.target.value })} />
        </div>
      </Card>
    ))}

    {loans.length === 0 && <Card style={{ textAlign: "center", color: "#8b8b9e", padding: 16, fontSize: 12 }}>Sin préstamos. Hacé clic en "+ Agregar" para añadir financiamiento.</Card>}
  </>;
}

// ============================================================
// TAB: SENSIBILIDAD
// ============================================================
function SensibilidadTab({ data, currency, mobile }) {
  const [variable, setVariable] = useState("revenue_growth");
  const [range, setRange] = useState([-20, -10, 0, 10, 20]);

  const variables = [
    { key: "revenue_growth", label: "Crecimiento Revenue" },
    { key: "inflation", label: "Inflación" },
    { key: "fixed_cost", label: "Costos Fijos" },
    { key: "exchange_rate", label: "Tipo de Cambio" },
  ];

  const scenarios = useMemo(() => {
    if (!data) return [];
    return range.map(delta => {
      let modified = JSON.parse(JSON.stringify(data));
      const label = delta >= 0 ? `+${delta}%` : `${delta}%`;

      if (variable === "revenue_growth") {
        modified.revenueStreams = modified.revenueStreams.map(s => ({
          ...s,
          annualRealGrowth: (s.annualRealGrowth || []).map(g => g + delta),
        }));
      } else if (variable === "inflation") {
        modified.setup.inflationRates = (modified.setup.inflationRates || []).map(r => Math.max(0, r + delta));
      } else if (variable === "fixed_cost") {
        modified.fixedCosts = modified.fixedCosts.map(fc => ({
          ...fc,
          monthlyAmount: Math.round(fc.monthlyAmount * (1 + delta / 100)),
        }));
      } else if (variable === "exchange_rate") {
        if (modified.setup.exchangeRate) {
          modified.setup.exchangeRate = modified.setup.exchangeRate * (1 + delta / 100);
        }
        if (modified.setup.exchangeRates) {
          modified.setup.exchangeRates = modified.setup.exchangeRates.map(r => r * (1 + delta / 100));
        }
      }

      try {
        const proj = projectCashFlows(modified);
        const npv = computeNPV(proj, modified.setup.discountRate);
        const last = proj[proj.length - 1];
        return { label, delta, npv, finalCash: last?.closingCash || 0, projections: proj };
      } catch {
        return { label, delta, npv: 0, finalCash: 0, projections: [] };
      }
    });
  }, [data, variable, range]);

  const baseNPV = scenarios.find(s => s.delta === 0)?.npv || 0;

  const npvChartData = scenarios.map(s => ({
    name: s.label,
    VPN: Math.round(s.npv),
    "Caja Final": Math.round(s.finalCash),
  }));

  // Monthly cashflow comparison: base vs worst vs best
  const comparisonData = useMemo(() => {
    const base = scenarios.find(s => s.delta === 0);
    const worst = scenarios[0];
    const best = scenarios[scenarios.length - 1];
    if (!base?.projections.length) return [];
    return base.projections.map((p, i) => ({
      label: p.label,
      Base: p.closingCash,
      ...(worst ? { Pesimista: worst.projections[i]?.closingCash || 0 } : {}),
      ...(best ? { Optimista: best.projections[i]?.closingCash || 0 } : {}),
    }));
  }, [scenarios]);

  return <>
    {/* Config */}
    <Card style={{ marginBottom: 14 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Configuración</h3>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 2fr", gap: 8 }}>
        <Select label="Variable a Probar" value={variable} onChange={e => setVariable(e.target.value)}>
          {variables.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
        </Select>
        <Input label="Pasos (%, separados por coma)" value={range.join(", ")} onChange={e => {
          const vals = e.target.value.split(",").map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
          if (vals.length > 0) setRange(vals);
        }} />
      </div>
    </Card>

    {/* NPV Impact */}
    <Card style={{ marginBottom: 14 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Impacto en VPN</h3>
      <div style={{ fontSize: 11, color: "#8b8b9e", marginBottom: 8 }}>VPN Base: {formatCurrency(Math.round(baseNPV), false, currency)}</div>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <BarChart data={npvChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 9 }} tickFormatter={v => formatCurrency(v, true)} />
            <Tooltip content={<CTooltip currency={currency} />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="VPN" fill="#e85d04" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Caja Final" fill="#059669" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>

    {/* Scenario comparison */}
    {comparisonData.length > 0 && <Card>
      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Saldo de Caja: Base vs Escenarios</h3>
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={comparisonData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={Math.max(0, Math.floor(comparisonData.length / 12) - 1)} />
            <YAxis tick={{ fontSize: 9 }} tickFormatter={v => formatCurrency(v, true)} />
            <Tooltip content={<CTooltip currency={currency} />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={0} stroke="#dc2626" strokeDasharray="3 3" />
            <Line type="monotone" dataKey="Pesimista" stroke="#dc2626" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="Base" stroke="#e85d04" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Optimista" stroke="#059669" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>}

    {/* Scenario table */}
    <Card style={{ marginTop: 14 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Tabla de Escenarios</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e8e8ec" }}>
              {["Escenario", "VPN", "Caja Final", "Δ VPN vs Base"].map(h => (
                <th key={h} style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: "#8b8b9e" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f5f5f8", background: s.delta === 0 ? "#fff8f3" : "transparent" }}>
                <td style={{ padding: "5px 8px", fontWeight: s.delta === 0 ? 700 : 500 }}>{s.label}{s.delta === 0 ? " (base)" : ""}</td>
                <td style={{ padding: "5px 8px", textAlign: "right", color: s.npv >= 0 ? "#059669" : "#dc2626" }}>{formatCurrency(Math.round(s.npv), true, currency)}</td>
                <td style={{ padding: "5px 8px", textAlign: "right" }}>{formatCurrency(Math.round(s.finalCash), true, currency)}</td>
                <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 600, color: s.npv - baseNPV >= 0 ? "#059669" : "#dc2626" }}>{formatCurrency(Math.round(s.npv - baseNPV), true, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  </>;
}
