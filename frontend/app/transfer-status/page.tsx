'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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

function TransferStatusContent() {
  const searchParams = useSearchParams();
  const [transferId, setTransferId] = useState('');
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchTransferById = async (id: string) => {
    if (!id.trim()) {
      setError('Please enter a transfer ID');
      return;
    }

    setLoading(true);
    setError('');
    setTransfer(null);

    try {
      const data = await apiFetch(`/transfers/${id.trim()}`);
      setTransfer(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch transfer status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const idFromUrl = searchParams.get('id');
    if (idFromUrl) {
      setTransferId(idFromUrl);
      fetchTransferById(idFromUrl);
    }
  }, []);

  const handleSearch = async () => {
    fetchTransferById(transferId);
  };

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
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Transfer Status</h1>

      <div style={{ marginTop: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px' }}>
          Transfer ID:
        </label>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={transferId}
            onChange={(e) => setTransferId(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Enter transfer ID (UUID)"
            style={{
              flex: 1,
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontFamily: 'monospace',
            }}
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            marginTop: '20px',
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

      {transfer && (
        <div
          style={{
            marginTop: '20px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '20px',
            backgroundColor: '#f9fafb',
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Transfer Details</h2>

          <div style={{ display: 'grid', gap: '16px' }}>
            <div>
              <strong>Status:</strong>
              <span
                style={{
                  marginLeft: '10px',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  backgroundColor: getStatusColor(transfer.status) + '20',
                  color: getStatusColor(transfer.status),
                  fontWeight: 'bold',
                  fontSize: '14px',
                }}
              >
                {transfer.status}
              </span>
            </div>

            <div>
              <strong>Transfer ID:</strong>
              <div
                style={{
                  marginTop: '4px',
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  color: '#666',
                }}
              >
                {transfer.transfer_id}
              </div>
            </div>

            <div>
              <strong>From Account:</strong>
              <span style={{ marginLeft: '10px', fontFamily: 'monospace' }}>
                {transfer.from_acct}
              </span>
            </div>

            <div>
              <strong>To Account:</strong>
              <span style={{ marginLeft: '10px', fontFamily: 'monospace' }}>
                {transfer.to_acct}
              </span>
            </div>

            <div>
              <strong>Amount:</strong>
              <span style={{ marginLeft: '10px', fontSize: '18px', color: '#111' }}>
                ${transfer.amount.toFixed(2)}
              </span>
            </div>

            <div>
              <strong>Created At:</strong>
              <span style={{ marginLeft: '10px' }}>
                {new Date(transfer.created_at).toLocaleString()}
              </span>
            </div>

            {transfer.idempotency_key && (
              <div>
                <strong>Idempotency Key:</strong>
                <div
                  style={{
                    marginTop: '4px',
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    color: '#666',
                  }}
                >
                  {transfer.idempotency_key}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!transfer && !error && !loading && (
        <div
          style={{
            marginTop: '40px',
            textAlign: 'center',
            color: '#888',
            fontSize: '14px',
          }}
        >
          Enter a transfer ID to view its status
        </div>
      )}
    </div>
  );
}

export default function TransferStatusPage() {
  return (
    <Suspense fallback={<div style={{ padding: '20px' }}>Loading...</div>}>
      <TransferStatusContent />
    </Suspense>
  );
}
