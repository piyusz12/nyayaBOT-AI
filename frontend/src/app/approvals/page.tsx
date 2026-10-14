'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { useAuth } from '@/lib/auth-context';
import {
  listCases,
  listActions,
  approveAction,
  submitHitlDecision,
  type ActionItem,
  type CaseSummary,
} from '@/lib/api';
import {
  UserCheck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Scale,
  ArrowRight,
  ShieldAlert,
  Clock,
  DollarSign,
} from 'lucide-react';

interface ApprovalCardData extends ActionItem {
  case_number: string;
  merchant: string;
  requested_amount: number | null;
}

export default function ApprovalCenterPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [pendingActions, setPendingActions] = useState<ApprovalCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadPending = async () => {
    try {
      const cases = await listCases();
      const allPending: ApprovalCardData[] = [];

      for (const c of cases) {
        try {
          const acts = await listActions(c.id);
          const pending = acts
            .filter((a) => a.status === 'proposed')
            .map((a) => ({
              ...a,
              case_number: c.case_number,
              merchant: c.merchant_name,
              requested_amount: c.requested_amount,
            }));
          allPending.push(...pending);
        } catch {
          // ignore per-case error
        }
      }

      setPendingActions(allPending);
    } catch {
      setPendingActions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (isAuthenticated) loadPending();
  }, [isAuthenticated, authLoading, router]);

  const handleDecision = async (action: ApprovalCardData, decision: 'approved' | 'rejected') => {
    setProcessingId(action.id);
    setSuccessMsg(null);
    const notes = decisionNotes[action.id] || '';

    try {
      await approveAction(action.id, decision, notes);
      setSuccessMsg(
        decision === 'approved'
          ? `Action approved successfully for ${action.merchant}. Case status updated.`
          : `Action rejected. Case escalated to Grievance Redressal Officer (GRO).`
      );
      await loadPending();
    } catch (err: any) {
      alert(err.message || 'Failed to process decision');
    } finally {
      setProcessingId(null);
    }
  };

  if (authLoading) return null;

  return (
    <>
      <Header title="Approval Center" />
      <div className="page-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Human-in-the-Loop (HITL) Approval Center</h1>
            <p className="page-subtitle">
              Strict governance gate: Autonomous counter-agent execution pauses whenever a financial settlement
              offer is tendered or high-impact escalation is recommended.
            </p>
          </div>
        </div>

        {successMsg && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(20, 184, 166, 0.15)',
              border: '1px solid var(--teal)',
              color: 'var(--teal)',
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <CheckCircle size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {loading ? (
          <div>
            {[1, 2].map((i) => (
              <div key={i} className="skeleton" style={{ height: 160, marginBottom: 16 }} />
            ))}
          </div>
        ) : pendingActions.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">
                <CheckCircle size={28} color="var(--success)" />
              </div>
              <div className="empty-state-title">All Consequential Actions Cleared</div>
              <div className="empty-state-desc">
                No settlement concessions or external filings require review. When the AI agent intercepts
                a merchant offer or proposes an escalation, it will appear here for your explicit authorization.
              </div>
              <Link href="/negotiations" className="btn btn-secondary btn-sm">
                Monitor Live Negotiations →
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {pendingActions.map((action) => {
              let payloadObj: Record<string, unknown> = {};
              try {
                payloadObj = JSON.parse(action.payload);
              } catch {
                payloadObj = { raw: action.payload };
              }

              const rawOffer = payloadObj.merchant_offer_inr ?? payloadObj.offer_amount_inr ?? payloadObj.amount;
              const offerAmt = typeof rawOffer === 'number' ? rawOffer : null;
              const requestedAmt = action.requested_amount || 0;
              const difference = offerAmt !== null ? Math.max(0, requestedAmt - offerAmt) : null;

              return (
                <div key={action.id} className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--brand-primary-light)' }}>
                          {action.case_number}
                        </span>
                        <span style={{ fontSize: 16, fontWeight: 700 }}>{action.merchant}</span>
                        <span className="badge badge-review">Awaiting Approval</span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {action.action_type.replace(/_/g, ' ').toUpperCase()}
                      </div>
                    </div>

                    <Link href={`/cases/${action.case_id}`} className="btn btn-ghost btn-sm">
                      Inspect Dossier Context →
                    </Link>
                  </div>

                  {/* Financial Comparison Metrics */}
                  <div className="hitl-metrics-row" style={{ margin: '16px 0' }}>
                    <div className="hitl-metric-item">
                      <div className="hitl-metric-label">Proposed Settlement Offer</div>
                      <div className="hitl-metric-val" style={{ color: 'var(--success)' }}>
                        {offerAmt !== null ? `₹${offerAmt.toLocaleString('en-IN')}` : 'Not Specified'}
                      </div>
                    </div>
                    <div className="hitl-metric-item">
                      <div className="hitl-metric-label">Original Claim</div>
                      <div className="hitl-metric-val">
                        ₹{requestedAmt.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="hitl-metric-item">
                      <div className="hitl-metric-label">Haircut / Forfeited</div>
                      <div className="hitl-metric-val" style={{ color: 'var(--warning)' }}>
                        {difference !== null ? `-₹${difference.toLocaleString('en-IN')}` : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* Legal Grounding */}
                  <div
                    style={{
                      padding: 12,
                      background: 'var(--bg-surface-raised)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 12.5,
                      color: 'var(--text-secondary)',
                      marginBottom: 16,
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <strong>Statutory Context:</strong> Consumer Protection Act, 2019 Section 2(47) & CCPA Dark Pattern Guidelines.
                    Accepting this offer concludes negotiations and closes the claim as resolved. Rejecting this offer
                    triggers immediate formal escalation to the company Grievance Redressal Officer (GRO) and NCH.
                  </div>

                  {/* Operator Notes Input */}
                  <div style={{ marginBottom: 16 }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter optional audit remarks or instructions for the record..."
                      value={decisionNotes[action.id] || ''}
                      onChange={(e) =>
                        setDecisionNotes({ ...decisionNotes, [action.id]: e.target.value })
                      }
                      style={{ fontSize: 13 }}
                    />
                  </div>

                  {/* Decision Actions */}
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDecision(action, 'rejected')}
                      disabled={processingId === action.id}
                    >
                      <XCircle size={15} />
                      <span>Reject & Escalate to GRO</span>
                    </button>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleDecision(action, 'approved')}
                      disabled={processingId === action.id}
                    >
                      <CheckCircle size={15} />
                      <span>{processingId === action.id ? 'Authorizing...' : 'Approve Settlement'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
