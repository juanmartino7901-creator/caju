"use client";
import { useState, useMemo } from "react";

export default function ModuleLauncher({ modules, onSelect, userName, userInitial, userAvatar, userRoleLabel, onSignOut, mobile }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return modules;
    const q = search.toLowerCase();
    return modules.filter(m => m.label.toLowerCase().includes(q) || m.description.toLowerCase().includes(q));
  }, [modules, search]);

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7fa", fontFamily: "system-ui, -apple-system, sans-serif", color: "#1a1a2e" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: mobile ? "16px 16px 0" : "24px 40px 0", maxWidth: 960, margin: "0 auto", width: "100%" }}>
        <div>
          <div style={{ fontSize: mobile ? 28 : 36, fontWeight: 800, letterSpacing: "-0.03em" }}>
            <span style={{ color: "#e85d04" }}>Caj</span>ú
          </div>
          <div style={{ fontSize: 10, color: "#e85d04", letterSpacing: "0.08em", fontWeight: 600, marginTop: -2 }}>PLATAFORMA</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>{userName}</div>
            <div style={{ fontSize: 10, color: "#8b8b9e" }}>{userRoleLabel}</div>
          </div>
          {userAvatar
            ? <img src={userAvatar} alt="" style={{ width: 34, height: 34, borderRadius: 10 }} referrerPolicy="no-referrer" />
            : <div style={{ width: 34, height: 34, borderRadius: 10, background: "#e85d04", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>{userInitial}</div>
          }
          <button onClick={onSignOut} title="Cerrar sesión" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#8b8b9e", padding: 4 }}>⏻</button>
        </div>
      </div>

      {/* Search + Grid */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: mobile ? "32px 16px" : "48px 40px" }}>
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{ fontSize: mobile ? 20 : 24, fontWeight: 700, marginBottom: 6, color: "#1a1a2e" }}>
            Bienvenido de vuelta
          </div>
          <div style={{ fontSize: 14, color: "#8b8b9e", marginBottom: 24 }}>
            Seleccioná un módulo para comenzar
          </div>
          <div style={{ maxWidth: 400, margin: "0 auto" }}>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar módulos..."
              style={{
                width: "100%", padding: "10px 16px", borderRadius: 10,
                border: "1px solid #e0e0e6", fontSize: 14, outline: "none",
                background: "#fff", color: "#1a1a2e",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}
            />
          </div>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: mobile ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(200px, 1fr))",
          gap: mobile ? 12 : 20,
        }}>
          {filtered.map(mod => (
            <button
              key={mod.key}
              onClick={() => onSelect(mod.key)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: mobile ? 8 : 12,
                padding: mobile ? "24px 12px" : "36px 20px",
                background: "#fff", border: "1px solid #e8e8ec",
                borderRadius: 16, cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.03)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.08)"; e.currentTarget.style.borderColor = "#e85d04"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)"; e.currentTarget.style.borderColor = "#e8e8ec"; }}
            >
              <div style={{ fontSize: mobile ? 36 : 48 }}>{mod.icon}</div>
              <div style={{ fontSize: mobile ? 13 : 15, fontWeight: 700, color: "#1a1a2e" }}>{mod.label}</div>
              <div style={{ fontSize: mobile ? 10 : 12, color: "#8b8b9e", lineHeight: 1.4, textAlign: "center" }}>{mod.description}</div>
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "#8b8b9e", fontSize: 14 }}>
            No se encontraron módulos
          </div>
        )}
      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button { font-family: inherit; }
        input { font-family: inherit; }
      `}</style>
    </div>
  );
}
