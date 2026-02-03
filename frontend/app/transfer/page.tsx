"use client";

import { useEffect, useState } from "react";
import { apiFetch, uuidv4 } from "@/lib/api";

type Account = { account_id: string; status: string };

export default function TransferPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [from, setFrom] = useState("ACC1001");
  const [to, setTo] = useState("ACC2001");
  const [amount, setAmount] = useState("10");
  const [mode, setMode] = useState<"sync" | "async">("sync");
  const [msg, setMsg] = useState<string>("");

  async function loadAccounts() {
    try {
      const data = await apiFetch("/accounts/me");
      setAccounts(data);
      if (data.length) {
        setFrom(data[0].account_id);
        if (data.length > 1) setTo(data[1].account_id);
      }
    } catch (err) {
      console.error("Failed to load accounts:", err);
    }
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  const submit = async () => {
    setMsg("");
    try {
      const idem = uuidv4();
      const data = await apiFetch("/transfers", {
        method: "POST",
        headers: { "Idempotency-Key": idem },
        body: JSON.stringify({ from_acct: from, to_acct: to, amount: Number(amount), mode }),
      });
      setMsg(`OK: ${JSON.stringify(data)}`);
    } catch (err: any) {
      setMsg(`Error: ${err.message}`);
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <h2>Transfer</h2>

      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <label>From</label>
          <select value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: 8, width: "100%" }}>
            {accounts.map((a) => (
              <option key={a.account_id} value={a.account_id}>{a.account_id}</option>
            ))}
          </select>
        </div>

        <div>
          <label>To</label>
          <input value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: 8, width: "100%" }} />
          <div style={{ color: "#666", fontSize: 12 }}>Tip: demo accounts are ACC1001 and ACC2001</div>
        </div>

        <div>
          <label>Amount</label>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} style={{ padding: 8, width: "100%" }} />
        </div>

        <div>
          <label>Mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as any)} style={{ padding: 8, width: "100%" }}>
            <option value="sync">sync (commit immediately)</option>
            <option value="async">async (background finalize)</option>
          </select>
        </div>

        <button onClick={submit} style={{ padding: "10px 14px" }}>Send Transfer</button>
        {msg && <pre style={{ padding: 12, background: "#f7f7f7", borderRadius: 8, overflowX: "auto" }}>{msg}</pre>}
      </div>
    </div>
  );
}
