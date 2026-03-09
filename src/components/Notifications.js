"use client";

export default function Notifications({ notification, nav, setNotification, mobile }) {
  if (!notification) return null;
  return <div
    onClick={() => { if (notification.linkId && notification.type === "supplier_created") { nav("suppliers", notification.linkId); setNotification(null); } }}
    style={{ position: "fixed", top: mobile ? 8 : 14, right: mobile ? 8 : 14, left: mobile ? 8 : "auto", zIndex: 999, padding: "10px 16px", borderRadius: 10, background: notification.type === "success" || notification.type === "supplier_created" ? "#059669" : "#ef4444", color: "#fff", fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", textAlign: "center", cursor: notification.linkId ? "pointer" : "default" }}
  >
    {notification.msg}
  </div>;
}
