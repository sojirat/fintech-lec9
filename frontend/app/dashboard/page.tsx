"use client";

import { useEffect, useState } from "react";
import { apiFetch, clearToken } from "@/lib/api";

type Account = { account_id: string; status: string };
type Balance = { account_id: string; balance: number };

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState("");

  async function loadAccounts() {
    try {
      const data = await apiFetch("/accounts/me");
      setAccounts(data);
      if (data.length && !selected) setSelected(data[0].account_id);
    } catch (err) {
      console.error("Failed to load accounts:", err);
    }
  }

  async function loadBalance(acct: string) {
    try {
      const data = await apiFetch(`/accounts/${acct}/balance`);
      setBalance(data);
    } catch (err) {
      console.error("Failed to load balance:", err);
    }
  }

  async function updateAccountStatus(newStatus: string) {
    if (!selected) return;
    setUpdating(true);
    setMessage("");

    try {
      await apiFetch(`/accounts/${selected}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      const statusMsg = newStatus === "frozen" ? "frozen" : newStatus === "closed" ? "closed" : "activated";
      setMessage(`Account ${statusMsg} successfully`);
      await loadAccounts();
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setUpdating(false);
      setTimeout(() => setMessage(""), 3000);
    }
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (selected) loadBalance(selected);
    const t = setInterval(() => {
      if (selected) loadBalance(selected);
    }, 4000);
    return () => clearInterval(t);
  }, [selected]);

  return (
    <div style={{ maxWidth: 700 }}>
      <h2>Dashboard</h2>
      <button onClick={() => { clearToken(); location.href = "/login"; }} style={{ padding: "6px 10px" }}>
        Logout
      </button>

      <div style={{ marginTop: 16 }}>
        <label>Account</label>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ padding: 8, width: "100%" }}>
          {accounts.map((a) => (
            <option key={a.account_id} value={a.account_id}>
              {a.account_id} ({a.status})
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h3>Balance</h3>
        <p>{balance ? `${balance.account_id}: ${balance.balance.toFixed(2)}` : "—"}</p>
        <p style={{ color: "#666" }}>Auto-refresh every 4 seconds (polling).</p>
      </div>

      {selected && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          <h3>Account Controls</h3>
          <p style={{ marginBottom: 12 }}>
            Current status: <strong>{accounts.find(a => a.account_id === selected)?.status || "unknown"}</strong>
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => updateAccountStatus("frozen")}
              disabled={updating || accounts.find(a => a.account_id === selected)?.status === "frozen"}
              style={{
                padding: "8px 16px",
                backgroundColor: accounts.find(a => a.account_id === selected)?.status === "frozen" ? "#ccc" : "#dc3545",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: updating || accounts.find(a => a.account_id === selected)?.status === "frozen" ? "not-allowed" : "pointer",
              }}
            >
              Freeze Account
            </button>
            <button
              onClick={() => updateAccountStatus("active")}
              disabled={updating || accounts.find(a => a.account_id === selected)?.status === "active"}
              style={{
                padding: "8px 16px",
                backgroundColor: accounts.find(a => a.account_id === selected)?.status === "active" ? "#ccc" : "#28a745",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: updating || accounts.find(a => a.account_id === selected)?.status === "active" ? "not-allowed" : "pointer",
              }}
            >
              Activate Account
            </button>
            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to close this account? This action cannot be undone.")) {
                  updateAccountStatus("closed");
                }
              }}
              disabled={updating || accounts.find(a => a.account_id === selected)?.status === "closed"}
              style={{
                padding: "8px 16px",
                backgroundColor: accounts.find(a => a.account_id === selected)?.status === "closed" ? "#ccc" : "#6c757d",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: updating || accounts.find(a => a.account_id === selected)?.status === "closed" ? "not-allowed" : "pointer",
              }}
            >
              Close Account
            </button>
          </div>

          {message && (
            <div
              style={{
                marginTop: 12,
                padding: 8,
                backgroundColor: message.startsWith("Error") ? "#fee" : "#efe",
                border: `1px solid ${message.startsWith("Error") ? "#fcc" : "#cfc"}`,
                borderRadius: 4,
                color: message.startsWith("Error") ? "#c00" : "#060",
              }}
            >
              {message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
