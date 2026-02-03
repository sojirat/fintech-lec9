'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface Transfer {
  transfer_id: string;
  from_acct: string;
  to_acct: string;
  amount: number;
  status: string;
  created_at: string;
  idempotency_key: string | null;
}

export default function RecentTransfersPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(50);

  const fetchTransfers = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch(`/transfers?limit=${limit}`);
      setTransfers(data.transfers || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch transfers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, [limit]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return '#10b981';
      case 'FAILED':
        return '#ef4444';
      case 'PROCESSING':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Recent Transfers</h1>

      <div style={{ marginTop: '20px', marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <label>Show:</label>
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
        >
          <option value={10}>10 transfers</option>
          <option value={25}>25 transfers</option>
          <option value={50}>50 transfers</option>
          <option value={100}>100 transfers</option>
          <option value={200}>200 transfers</option>
        </select>
        <button
          onClick={fetchTransfers}
          style={{
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div
          style={{
            marginBottom: '20px',
            padding: '12px',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px',
            color: '#c00',
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
          Loading transfers...
        </div>
      ) : transfers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
          No transfers found
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid #ddd',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                  Date/Time
                </th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                  From Account
                </th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                  To Account
                </th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                  Amount
                </th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>
                  Status
                </th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                  Transfer ID
                </th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((transfer) => (
                <tr key={transfer.transfer_id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px' }}>
                    {new Date(transfer.created_at).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '14px' }}>
                    {transfer.from_acct}
                  </td>
                  <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '14px' }}>
                    {transfer.to_acct}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                    ${transfer.amount.toFixed(2)}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        backgroundColor: getStatusColor(transfer.status) + '20',
                        color: getStatusColor(transfer.status),
                        fontWeight: 'bold',
                        fontSize: '12px',
                      }}
                    >
                      {transfer.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <a
                      href={`/transfer-status?id=${transfer.transfer_id}`}
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '13px',
                        color: '#007bff',
                        textDecoration: 'none',
                      }}
                    >
                      {transfer.transfer_id.substring(0, 8)}...
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {transfers.length > 0 && (
        <div style={{ marginTop: '20px', color: '#666', fontSize: '14px' }}>
          Showing {transfers.length} transfer{transfers.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
