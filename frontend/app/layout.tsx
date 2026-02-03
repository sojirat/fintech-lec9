"use client";

import { useEffect, useState } from "react";
import { getToken, clearToken } from "@/lib/api";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!getToken());
  }, []);

  const handleLogout = () => {
    clearToken();
    setIsLoggedIn(false);
    window.location.href = "/login";
  };

  return (
    <html lang="en">
      <head>
        <title>Lab9 BaaS Starter Kit</title>
        <meta name="description" content="Mock Bank UI (Next.js) for FastAPI backend" />
      </head>
      <body style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial", margin: 0 }}>
        <div style={{ padding: 16, borderBottom: "1px solid #ddd" }}>
          <strong>Lab 9 — Mock Bank (BaaS)</strong>
          <span style={{ marginLeft: 12 }}>
            {isLoggedIn ? (
              <>
                <a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }} style={{ cursor: "pointer" }}>Logout</a>{" | "}
              </>
            ) : (
              <>
                <a href="/login">Login</a>{" | "}
              </>
            )}
            <a href="/dashboard">Dashboard</a>{" | "}
            <a href="/transfer">Transfer</a>{" | "}
            <a href="/transfer-status">Transfer Status</a>{" | "}
            <a href="/recent-transfers">Recent Transfers</a>{" | "}
            <a href="/transactions">Transactions</a>
          </span>
        </div>
        <div style={{ padding: 16 }}>{children}</div>
      </body>
    </html>
  );
}
