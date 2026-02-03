"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type Account = { account_id: string; status: string };
type Tx = { entry_id: number; direction: string; amount: number; ref_transfer_id: string; created_at: string };

export default function TransactionsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [txs, setTxs] = useState<Tx[]>([]);

  async function loadAccounts() {
    try {
      const data = await apiFetch("/accounts/me");
      setAccounts(data);
      if (data.length) setSelected(data[0].account_id);
    } catch (err) {
      console.error("Failed to load accounts:", err);
    }
  }

  async function loadTx(acct: string) {
    try {
      const data = await apiFetch(`/accounts/${acct}/transactions?limit=50`);
      setTxs(data);
    } catch (err) {
      console.error("Failed to load transactions:", err);
    }
  }

  useEffect(() => { loadAccounts(); }, []);
  useEffect(() => { if (selected) loadTx(selected); }, [selected]);

  return (
    <div style={{ maxWidth: 900 }}>
      <h2>Transactions</h2>

      <div style={{ marginBottom: 12 }}>
        <label>Account</label>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ padding: 8, width: "100%" }}>
          {accounts.map((a) => (
            <option key={a.account_id} value={a.account_id}>{a.account_id}</option>
          ))}
        </select>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Time</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Direction</th>
            <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Amount</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Transfer</th>
          </tr>
        </thead>
        <tbody>
          {txs.map((t) => (
            <tr key={t.entry_id}>
              <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0" }}>{new Date(t.created_at).toLocaleString()}</td>
              <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0" }}>{t.direction}</td>
              <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0", textAlign: "right" }}>{t.amount.toFixed(2)}</td>
              <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0" }}>{t.ref_transfer_id}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
