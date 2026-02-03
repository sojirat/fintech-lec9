export const metadata = {
  title: "Lab9 BaaS Starter Kit",
  description: "Mock Bank UI (Next.js) for FastAPI backend",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial", margin: 0 }}>
        <div style={{ padding: 16, borderBottom: "1px solid #ddd" }}>
          <strong>Lab 9 — Mock Bank (BaaS)</strong>
          <span style={{ marginLeft: 12 }}>
            <a href="/login">Login</a>{" | "}
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
