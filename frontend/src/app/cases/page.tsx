'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { useAuth } from '@/lib/auth-context';
import { listCases, type CaseSummary } from '@/lib/api';

const DISPUTE_LABELS: Record<string, string> = {
  subscription_cancellation: 'Subscription Cancellation',
  unauthorized_charge: 'Unauthorized Charge',
  refund_request: 'Refund Request',
  service_not_delivered: 'Service Not Delivered',
  defective_product: 'Defective Product',
  billing_error: 'Billing Error',
  dark_pattern: 'Dark Pattern',
  other: 'Other',
};

export default function CasesListPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (isAuthenticated) {
      listCases()
        .then(setCases)
        .catch(() => setCases([]))
        .finally(() => setLoading(false));
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) return null;

  const filteredCases =
    filter === 'all' ? cases : cases.filter((c) => c.status === filter);

  const statusCounts: Record<string, number> = {};
  cases.forEach((c) => {
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
  });

  return (
    <>
      <Header title="All Cases" />
      <div className="page-content">
        <div className="page-header animate-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 className="page-title">Dispute Cases</h2>
              <p className="page-subtitle">
                {cases.length} total case{cases.length !== 1 ? 's' : ''} across all statuses
              </p>
            </div>
            <Link href="/cases/new" className="btn btn-primary">
              ➕ New Dispute
            </Link>
          </div>
        </div>

        {/* Filter Chips */}
        <div
          className="animate-in"
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-6)',
            flexWrap: 'wrap',
          }}
        >
          {[
            { key: 'all', label: `All (${cases.length})` },
            { key: 'draft', label: `Draft (${statusCounts.draft || 0})` },
            { key: 'active', label: `Active (${statusCounts.active || 0})` },
            { key: 'escalated', label: `Escalated (${statusCounts.escalated || 0})` },
            { key: 'resolved', label: `Resolved (${statusCounts.resolved || 0})` },
          ].map((f) => (
            <button
              key={f.key}
              className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton" style={{ height: 52, marginBottom: 8 }} />
            ))}
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">📂</div>
              <div className="empty-state-title">
                {filter === 'all' ? 'No cases yet' : `No ${filter} cases`}
              </div>
              <div className="empty-state-desc">
                {filter === 'all'
                  ? 'Create your first dispute case to get started.'
                  : 'No cases match the selected filter.'}
              </div>
              {filter === 'all' && (
                <Link href="/cases/new" className="btn btn-primary">
                  ➕ File New Dispute
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="table-wrapper animate-in">
            <table className="table table-clickable">
              <thead>
                <tr>
                  <th>Case #</th>
                  <th>Merchant</th>
                  <th>Dispute Type</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Filed</th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.map((c) => (
                  <tr key={c.id} onClick={() => router.push(`/cases/${c.id}`)}>
                    <td
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {c.case_number}
                    </td>
                    <td style={{ fontWeight: 500 }}>{c.merchant_name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {DISPUTE_LABELS[c.dispute_type] || c.dispute_type}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                      {c.requested_amount
                        ? `${c.currency} ${c.requested_amount.toLocaleString()}`
                        : '—'}
                    </td>
                    <td>
                      <span className={`badge badge-${c.status}`}>{c.status}</span>
                    </td>
                    <td
                      style={{
                        color: 'var(--text-muted)',
                        fontSize: 12,
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
