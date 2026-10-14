'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { useAuth } from '@/lib/auth-context';
import {
  listCases,
  listActions,
  getTimeline,
  type CaseSummary,
  type ActionItem,
  type TimelineEntry,
} from '@/lib/api';
import {
  FolderKanban,
  Bot,
  CheckCircle,
  AlertOctagon,
  Clock,
  ArrowRight,
  TrendingUp,
  FileCheck,
  AlertTriangle,
  PlusCircle,
  ExternalLink,
} from 'lucide-react';

const DISPUTE_LABELS: Record<string, string> = {
  subscription_cancellation: 'Subscription Cancellation',
  unauthorized_charge: 'Unauthorized Charge',
  refund_request: 'Refund Request',
  service_not_delivered: 'Service Not Delivered',
  defective_product: 'Defective Product',
  billing_error: 'Billing Error',
  dark_pattern: 'Dark Pattern Trap',
  other: 'General Consumer Dispute',
};

export default function ExecutiveDashboard() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ActionItem[]>([]);
  const [recentEvents, setRecentEvents] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }

    if (isAuthenticated) {
      const fetchData = async () => {
        try {
          const caseList = await listCases();
          setCases(caseList);

          // Fetch pending approvals across cases
          const approvals: ActionItem[] = [];
          for (const c of caseList.slice(0, 8)) {
            try {
              const acts = await listActions(c.id);
              approvals.push(...acts.filter((a) => a.status === 'proposed'));
            } catch {
              // ignore per-case fetch fail
            }
          }
          setPendingApprovals(approvals);

          // Fetch timeline events from the most recently updated case
          if (caseList.length > 0) {
            try {
              const tl = await getTimeline(caseList[0].id);
              setRecentEvents(tl.entries.slice(-6).reverse());
            } catch {
              setRecentEvents([]);
            }
          }
        } catch (err) {
          console.error('Failed to load dashboard data', err);
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }
  }, [isAuthenticated, authLoading, router]);

  if (authLoading) {
    return (
      <>
        <Header title="Executive Overview" />
        <div className="page-content">
          <div className="skeleton" style={{ height: 160, marginBottom: 24 }} />
          <div className="skeleton" style={{ height: 350 }} />
        </div>
      </>
    );
  }

  // Calculate real metrics
  const totalDossiers = cases.length;
  const activeNegotiations = cases.filter((c) => c.status === 'active').length;
  const awaitingApproval = cases.filter((c) =>
    ['awaiting_approval', 'evidence_review'].includes(c.status)
  ).length + pendingApprovals.length;
  const escalationsCount = cases.filter((c) => c.status === 'escalated').length;
  const resolvedCount = cases.filter((c) => c.status === 'resolved').length;
  const totalDisputedAmount = cases.reduce((acc, c) => acc + (c.requested_amount || 0), 0);

  const filteredCases = cases.filter((c) => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return (
      c.merchant_name.toLowerCase().includes(q) ||
      c.case_number.toLowerCase().includes(q) ||
      c.dispute_type.toLowerCase().includes(q) ||
      c.status.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <Header title="Executive Overview" />
      <div className="page-content">
        {/* Page Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Executive Command Dashboard</h1>
            <p className="page-subtitle">
              Real-time monitoring of consumer dispute dossiers, multi-agent merchant negotiations,
              and statutory escalations under CPA 2019.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Link href="/cases/new" className="btn btn-primary">
              <PlusCircle size={16} />
              <span>Create Dispute Dossier</span>
            </Link>
            <Link href="/negotiations" className="btn btn-secondary">
              <Bot size={16} />
              <span>Live Console</span>
            </Link>
          </div>
        </div>

        {/* ── KPI Metric Cards ────────────────────────────────────────── */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Total Dossiers</span>
              <div className="stat-icon primary">
                <FolderKanban size={18} />
              </div>
            </div>
            <div className="stat-value">{totalDossiers}</div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Registered consumer files</span>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Active Negotiations</span>
              <div className="stat-icon primary">
                <Bot size={18} />
              </div>
            </div>
            <div className="stat-value" style={{ color: 'var(--brand-primary-light)' }}>
              {activeNegotiations}
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Autonomous agent sessions</span>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Awaiting Human Approval</span>
              <div className="stat-icon warning">
                <AlertOctagon size={18} />
              </div>
            </div>
            <div className="stat-value" style={{ color: 'var(--warning)' }}>
              {awaitingApproval}
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Consequential actions pending</span>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Escalations in Progress</span>
              <div className="stat-icon error">
                <AlertTriangle size={18} />
              </div>
            </div>
            <div className="stat-value" style={{ color: 'var(--error)' }}>
              {escalationsCount}
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>GRO, NCH & Banking routes</span>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Resolved Disputes</span>
              <div className="stat-icon success">
                <CheckCircle size={18} />
              </div>
            </div>
            <div className="stat-value" style={{ color: 'var(--success)' }}>
              {resolvedCount}
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Settlements & refunds secured</span>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Disputed Exposure</span>
              <div className="stat-icon primary">
                <TrendingUp size={18} />
              </div>
            </div>
            <div className="stat-value" style={{ fontSize: 24 }}>
              ₹{totalDisputedAmount.toLocaleString('en-IN')}
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total monetary value under dispute</span>
          </div>
        </div>

        {/* ── B. Workflow Overview Ribbon ─────────────────────────────── */}
        <div className="card" style={{ marginBottom: 'var(--space-8)' }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">Dispute Resolution Execution Pipeline</h2>
              <p className="card-description">Sequential state progression from intake to statutory escalation</p>
            </div>
          </div>
          <div className="workflow-ribbon">
            <div className="workflow-step-card completed">
              <span className="workflow-step-num">Step 01</span>
              <span className="workflow-step-name">Dossier Intake</span>
              <span style={{ fontSize: 11, color: 'var(--success)' }}>✓ Facts Verified</span>
            </div>
            <div className="workflow-step-card completed">
              <span className="workflow-step-num">Step 02</span>
              <span className="workflow-step-name">Evidence OCR</span>
              <span style={{ fontSize: 11, color: 'var(--success)' }}>✓ PyMuPDF & Hash</span>
            </div>
            <div className="workflow-step-card active">
              <span className="workflow-step-num">Step 03</span>
              <span className="workflow-step-name">Merchant Session</span>
              <span style={{ fontSize: 11, color: 'var(--brand-primary-light)' }}>● Live Streaming</span>
            </div>
            <div className="workflow-step-card active">
              <span className="workflow-step-num">Step 04</span>
              <span className="workflow-step-name">AI Legal Analysis</span>
              <span style={{ fontSize: 11, color: 'var(--brand-primary-light)' }}>● CPA 2019 & CCPA</span>
            </div>
            <div className="workflow-step-card">
              <span className="workflow-step-num">Step 05</span>
              <span className="workflow-step-name">Human Review</span>
              <span style={{ fontSize: 11, color: 'var(--warning)' }}>HITL Settlement Gate</span>
            </div>
            <div className="workflow-step-card">
              <span className="workflow-step-num">Step 06</span>
              <span className="workflow-step-name">Resolution / Escalation</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Refund or GRO / NCH</span>
            </div>
          </div>
        </div>

        {/* ── D. Attention Required Banner (if any) ────────────────────── */}
        {pendingApprovals.length > 0 && (
          <div className="hitl-banner" style={{ marginBottom: 'var(--space-8)' }}>
            <div className="hitl-banner-header">
              <AlertTriangle size={20} color="var(--warning)" />
              <div className="hitl-banner-title">
                Attention Required: {pendingApprovals.length} Consequential Action(s) Awaiting Human Authorization
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
              Under PS 30 safety sentinel protocols, settlement concessions, financial compromises, and formal
              statutory filings require explicit operator approval before transmission.
            </p>
            <Link href="/approvals" className="btn btn-primary btn-sm">
              Review Pending Approvals ({pendingApprovals.length}) →
            </Link>
          </div>
        )}

        {/* ── Grid: Active Disputes & Recent Activity ──────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-6)' }}>
          {/* A. Active Disputes Table */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Dispute Dossiers Registry</h2>
                <p className="card-description">Active consumer dispute portfolios and execution states</p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="text"
                  placeholder="Filter cases..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{
                    padding: '5px 10px',
                    fontSize: 12,
                    background: 'var(--bg-surface-raised)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                  }}
                />
                <Link href="/cases" className="btn btn-ghost btn-sm">
                  View All →
                </Link>
              </div>
            </div>

            {loading ? (
              <div>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton" style={{ height: 48, marginBottom: 8 }} />
                ))}
              </div>
            ) : filteredCases.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <FolderKanban size={24} />
                </div>
                <div className="empty-state-title">No Dispute Dossiers Found</div>
                <div className="empty-state-desc">
                  Start by filing a consumer dispute dossier with merchant details, transactions, and evidence.
                </div>
                <Link href="/cases/new" className="btn btn-primary btn-sm">
                  <PlusCircle size={14} />
                  <span>Create First Dossier</span>
                </Link>
              </div>
            ) : (
              <div className="table-wrapper" style={{ border: 'none', background: 'transparent' }}>
                <table className="table table-clickable">
                  <thead>
                    <tr>
                      <th>Dossier ID</th>
                      <th>Merchant</th>
                      <th>Disputed Amount</th>
                      <th>Dispute Type</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCases.slice(0, 7).map((c) => (
                      <tr key={c.id} onClick={() => router.push(`/cases/${c.id}`)}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600 }}>
                          {c.case_number}
                        </td>
                        <td style={{ fontWeight: 600 }}>{c.merchant_name}</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>
                          {c.requested_amount
                            ? `₹${c.requested_amount.toLocaleString('en-IN')}`
                            : '—'}
                        </td>
                        <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                          {DISPUTE_LABELS[c.dispute_type] || c.dispute_type}
                        </td>
                        <td>
                          <span className={`badge badge-${c.status}`}>{c.status}</span>
                        </td>
                        <td>
                          <Link
                            href={`/cases/${c.id}`}
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => e.stopPropagation()}
                            style={{ padding: '4px 8px' }}
                          >
                            <ExternalLink size={13} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* C. Recent Activity Feed */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Audit & Agent Events</h2>
                <p className="card-description">Live system logs and evidence actions</p>
              </div>
              <Link href="/audit" className="btn btn-ghost btn-sm">
                Full Trail →
              </Link>
            </div>

            {recentEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-8) var(--space-4)', color: 'var(--text-muted)', fontSize: 13 }}>
                <Clock size={24} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                No recent events recorded. Actions will appear in real time.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {recentEvents.map((evt, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 10,
                      background: 'var(--bg-surface-raised)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: 12.5,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{evt.title}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                        {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {evt.description && (
                      <p style={{ color: 'var(--text-secondary)', fontSize: 11.5, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {evt.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
