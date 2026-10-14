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

export default function DashboardPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (isAuthenticated) {
      listCases()
        .then(setCases)
        .catch(() => setCases([]))
        .finally(() => setLoadingCases(false));
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <>
        <Header title="Dashboard" />
        <div className="page-content">
          <div className="skeleton" style={{ height: 200, marginBottom: 24 }} />
          <div className="skeleton" style={{ height: 300 }} />
        </div>
      </>
    );
  }

  if (!isAuthenticated) return null;

  const totalCases = cases.length;
  const activeCases = cases.filter((c) => c.status === 'active').length;
  const pendingReview = cases.filter((c) =>
    ['intake_pending', 'evidence_review', 'awaiting_approval'].includes(c.status)
  ).length;
  const resolvedCases = cases.filter((c) => c.status === 'resolved').length;
  const totalAmount = cases.reduce((s, c) => s + (c.requested_amount || 0), 0);

  return (
    <>
      <Header title="Dashboard" />
      <div className="page-content">
        {/* Page Header */}
        <div className="page-header animate-in">
          <h2 className="page-title">
            Welcome to Garuda AI
          </h2>
          <p className="page-subtitle">
            Your AI-powered consumer dispute resolution command center
          </p>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card animate-in stagger-1">
            <div className="stat-icon primary">📁</div>
            <div className="stat-value">{totalCases}</div>
            <div className="stat-label">Total Cases</div>
          </div>
          <div className="stat-card animate-in stagger-2">
            <div className="stat-icon warning">⚡</div>
            <div className="stat-value">{activeCases}</div>
            <div className="stat-label">Active Disputes</div>
          </div>
          <div className="stat-card animate-in stagger-3">
            <div className="stat-icon error">🔔</div>
            <div className="stat-value">{pendingReview}</div>
            <div className="stat-label">Pending Review</div>
          </div>
          <div className="stat-card animate-in stagger-4">
            <div className="stat-icon success">✓</div>
            <div className="stat-value">{resolvedCases}</div>
            <div className="stat-label">Resolved</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card animate-in" style={{ marginBottom: 'var(--space-8)' }}>
          <div className="card-header">
            <h3 className="card-title">Quick Actions</h3>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <Link href="/cases/new" className="btn btn-primary btn-lg">
              ➕ File New Dispute
            </Link>
            <Link href="/cases" className="btn btn-secondary">
              📁 View All Cases
            </Link>
            <Link href="/approvals" className="btn btn-secondary">
              ✅ Pending Approvals
            </Link>
          </div>
        </div>

        {/* Amount Summary */}
        {totalAmount > 0 && (
          <div className="card animate-in" style={{ marginBottom: 'var(--space-8)' }}>
            <div className="card-header">
              <h3 className="card-title">Dispute Summary</h3>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-10)', alignItems: 'baseline' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                  Total Disputed Amount
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.04em' }}>
                  ₹{totalAmount.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Cases */}
        <div className="card animate-in">
          <div className="card-header">
            <h3 className="card-title">Recent Cases</h3>
            <Link href="/cases" className="btn btn-ghost btn-sm">
              View All →
            </Link>
          </div>

          {loadingCases ? (
            <div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton" style={{ height: 48, marginBottom: 8 }} />
              ))}
            </div>
          ) : cases.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📂</div>
              <div className="empty-state-title">No cases yet</div>
              <div className="empty-state-desc">
                File your first consumer dispute to get started with Garuda AI.
              </div>
              <Link href="/cases/new" className="btn btn-primary">
                ➕ File New Dispute
              </Link>
            </div>
          ) : (
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table table-clickable">
                <thead>
                  <tr>
                    <th>Case #</th>
                    <th>Merchant</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Filed</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.slice(0, 5).map((c) => (
                    <tr key={c.id} onClick={() => router.push(`/cases/${c.id}`)}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {c.case_number}
                      </td>
                      <td style={{ fontWeight: 500 }}>{c.merchant_name}</td>
                      <td>{DISPUTE_LABELS[c.dispute_type] || c.dispute_type}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {c.requested_amount
                          ? `${c.currency} ${c.requested_amount.toLocaleString()}`
                          : '—'}
                      </td>
                      <td>
                        <span className={`badge badge-${c.status}`}>{c.status}</span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
