"use client";

import { useState } from "react";
import { setToken } from "@/lib/api";

export default function LoginPage() {
  const [username, setUsername] = useState("student");
  const [password, setPassword] = useState("studentpass");
  const [msg, setMsg] = useState<string>("");

  const handleLogin = async () => {
    setMsg("");
    const form = new URLSearchParams();
    form.set("username", username);
    form.set("password", password);

    const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
    const res = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    if (!res.ok) {
      setMsg("Login failed");
      return;
    }
    const data = await res.json();
    setToken(data.access_token);
    setMsg("Login success. Go to Dashboard.");
  };

  return (
    <div style={{ maxWidth: 520 }}>
      <h2>Login</h2>
      <p>Demo credentials are pre-seeded.</p>
      <label>Username</label>
      <input value={username} onChange={(e) => setUsername(e.target.value)} style={{ width: "100%", padding: 8, marginBottom: 10 }} />
      <label>Password</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%", padding: 8, marginBottom: 10 }} />
      <button onClick={handleLogin} style={{ padding: "8px 12px" }}>Login</button>
      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </div>
  );
}
