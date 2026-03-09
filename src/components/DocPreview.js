"use client";
import { useState, useEffect } from "react";
import { Card } from "@/components/SharedUI";

export default function DocPreview({ inv, supabase }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!inv.file_path) return;
    setLoading(true);
    setError(false);

    supabase.storage.from("invoices").createSignedUrl(inv.file_path, 3600)
      .then(({ data, error: signErr }) => {
        if (signErr || !data?.signedUrl) throw signErr || new Error("No signed URL");
        setUrl(data.signedUrl);
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [inv.file_path, supabase]);

  if (!inv.file_path) {
    return <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#fafafa", minHeight: 160 }}>
      <div style={{ fontSize: 40, opacity: 0.2, marginBottom: 4 }}>📄</div>
      <div style={{ fontSize: 12, color: "#8b8b9e" }}>Sin documento adjunto</div>
    </Card>;
  }

  return <Card style={{ display: "flex", flexDirection: "column", background: "#fafafa", minHeight: 160, overflow: "hidden" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700 }}>Documento</h3>
      {url && <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 600, color: "#e85d04", textDecoration: "none" }}>↗ Abrir</a>}
    </div>
    {loading ? (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 120 }}>
        <div style={{ width: 24, height: 24, border: "2px solid #e8e8ec", borderTopColor: "#e85d04", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <div style={{ fontSize: 11, color: "#8b8b9e", marginTop: 8 }}>Cargando preview...</div>
      </div>
    ) : error ? (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 120 }}>
        <div style={{ fontSize: 32, opacity: 0.3, marginBottom: 4 }}>⚠️</div>
        <div style={{ fontSize: 12, color: "#8b8b9e" }}>No se pudo cargar el documento</div>
        <div style={{ fontSize: 11, color: "#b0b0c0", marginTop: 2 }}>Verificá que el bucket "invoices" sea público en Supabase</div>
      </div>
    ) : url && inv.file_type === "pdf" ? (
      <iframe
        src={`${url}#toolbar=0`}
        style={{ flex: 1, width: "100%", minHeight: 300, border: "1px solid #e8e8ec", borderRadius: 8, background: "#fff" }}
        title="Preview factura"
      />
    ) : url ? (
      <img
        src={url}
        alt="Factura"
        style={{ width: "100%", maxHeight: 400, objectFit: "contain", borderRadius: 8, border: "1px solid #e8e8ec", background: "#fff" }}
        onError={() => setError(true)}
      />
    ) : null}
  </Card>;
}
