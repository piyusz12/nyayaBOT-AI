'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { useAuth } from '@/lib/auth-context';
import { listCases, listActions, approveAction, type CaseSummary, type ActionItem } from '@/lib/api';

export default function ApprovalsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [pendingActions, setPendingActions] = useState<(ActionItem & { case_number: string; merchant: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (isAuthenticated) {
      loadPending();
    }
  }, [isAuthenticated, isLoading, router]);

  const loadPending = async () => {
    try {
      const cases = await listCases();
      const allPending: (ActionItem & { case_number: string; merchant: string })[] = [];

      for (const c of cases) {
        const actions = await listActions(c.id);
        const pending = actions
          .filter((a) => a.status === 'proposed')
          .map((a) => ({ ...a, case_number: c.case_number, merchant: c.merchant_name }));
        allPending.push(...pending);
      }

      setPendingActions(allPending);
    } catch {
      setPendingActions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (actionId: string, decision: string) => {
    try {
      await approveAction(actionId, decision);
      loadPending();
    } catch {
      alert('Failed to process approval');
    }
  };

  if (isLoading || !isAuthenticated) return null;

  return (
    <>
      <Header title="Approvals" />
      <div className="page-content">
        <div className="page-header animate-in">
          <h2 className="page-title">Pending Approvals</h2>
          <p className="page-subtitle">
            Review and authorize agent-proposed actions before execution
          </p>
        </div>

        {loading ? (
          <div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 80, marginBottom: 12 }} />
            ))}
          </div>
        ) : pendingActions.length === 0 ? (
          <div className="card animate-in">
            <div className="empty-state">
              <div className="empty-state-icon">✅</div>
              <div className="empty-state-title">All clear</div>
              <div className="empty-state-desc">
                No pending approvals. Actions will appear here when the agent proposes
                consequential operations that require your authorization.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {pendingActions.map((action) => (
              <div key={action.id} className="card animate-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                        {action.case_number}
                      </span>
                      <span style={{ fontWeight: 500 }}>{action.merchant}</span>
                      <span className="badge badge-review">pending</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                      {action.action_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {action.payload}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleDecision(action.id, 'approved')}
                    >
                      ✅ Approve
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDecision(action.id, 'rejected')}
                    >
                      ❌ Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
