'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { useAuth } from '@/lib/auth-context';
import {
  getCase,
  getTimeline,
  listEvidence,
  listTransactions,
  listEscalations,
  uploadEvidence,
  addTransaction,
  createEscalation,
  updateCase,
  type CaseDetail,
  type TimelineEntry,
  type EvidenceItem,
  type TransactionItem,
  type EscalationItem,
} from '@/lib/api';

const TABS = ['overview', 'timeline', 'evidence', 'transactions', 'escalations'] as const;
type Tab = (typeof TABS)[number];

const ESCALATION_CHANNELS = [
  { value: 'grievance_officer', label: 'Grievance Officer (Level 2)' },
  { value: 'nch', label: 'National Consumer Helpline' },
  { value: 'bank_dispute', label: 'Bank / Card Dispute' },
  { value: 'e_jagriti', label: 'e-Jagriti Complaint' },
  { value: 'other', label: 'Other' },
];

function CaseDetailPageContent() {
  const params = useParams();
  const caseId = params.id as string;
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [escalations, setEscalations] = useState<EscalationItem[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [c, t, e, tx, esc] = await Promise.all([
        getCase(caseId),
        getTimeline(caseId),
        listEvidence(caseId),
        listTransactions(caseId),
        listEscalations(caseId),
      ]);
      setCaseData(c);
      setTimeline(t.entries);
      setEvidence(e);
      setTransactions(tx);
      setEscalations(esc);
    } catch {
      router.push('/cases');
    } finally {
      setLoading(false);
    }
  }, [caseId, router]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (isAuthenticated) loadData();
  }, [isAuthenticated, authLoading, router, loadData]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadEvidence(caseId, file);
      }
      const updatedEvidence = await listEvidence(caseId);
      setEvidence(updatedEvidence);
      const updatedTimeline = await getTimeline(caseId);
      setTimeline(updatedTimeline.entries);
    } catch (err) {
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    try {
      await addTransaction(caseId, {
        amount: parseFloat(data.get('amount') as string),
        currency: data.get('currency') as string || 'INR',
        order_reference: data.get('order_reference') as string || undefined,
        description: data.get('description') as string || undefined,
      });
      form.reset();
      const [tx, tl] = await Promise.all([listTransactions(caseId), getTimeline(caseId)]);
      setTransactions(tx);
      setTimeline(tl.entries);
    } catch {
      alert('Failed to add transaction');
    }
  };

  const handleEscalate = async (channel: string) => {
    try {
      await createEscalation(caseId, channel);
      await updateCase(caseId, { status: 'escalated' });
      loadData();
    } catch {
      alert('Escalation failed');
    }
  };

  if (authLoading || loading) {
    return (
      <>
        <Header title="Case Details" />
        <div className="page-content">
          <div className="skeleton" style={{ height: 120, marginBottom: 24 }} />
          <div className="skeleton" style={{ height: 400 }} />
        </div>
      </>
    );
  }

  if (!caseData) return null;

  const currencySymbol: Record<string, string> = { INR: '₹', USD: '$', GBP: '£', EUR: '€' };

  return (
    <>
      <Header title={`Case ${caseData.case_number}`} />
      <div className="page-content">
        {/* Case Header Card */}
        <div className="card animate-in" style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
                  {caseData.merchant_name}
                </h2>
                <span className={`badge badge-${caseData.status}`}>{caseData.status}</span>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-6)', fontSize: 13, color: 'var(--text-secondary)' }}>
                <span>
                  <span style={{ color: 'var(--text-muted)' }}>Case:</span>{' '}
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{caseData.case_number}</span>
                </span>
                <span>
                  <span style={{ color: 'var(--text-muted)' }}>Type:</span>{' '}
                  {caseData.dispute_type.replace(/_/g, ' ')}
                </span>
                <span>
                  <span style={{ color: 'var(--text-muted)' }}>Jurisdiction:</span>{' '}
                  {caseData.jurisdiction}
                </span>
              </div>
            </div>
            {caseData.requested_amount && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Disputed Amount
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--garuda-accent-light)' }}>
                  {currencySymbol[caseData.currency] || ''}{caseData.requested_amount.toLocaleString()}
                </div>
              </div>
            )}
          </div>
          {caseData.description && (
            <p style={{ marginTop: 'var(--space-4)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)' }}>
              {caseData.description}
            </p>
          )}
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-1)',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: 'var(--space-6)',
          }}
        >
          {TABS.map((t) => (
            <button
              key={t}
              className={`btn btn-ghost btn-sm`}
              onClick={() => setTab(t)}
              style={{
                borderBottom: tab === t ? '2px solid var(--garuda-primary)' : '2px solid transparent',
                borderRadius: 0,
                color: tab === t ? 'var(--text-accent)' : 'var(--text-secondary)',
                fontWeight: tab === t ? 600 : 400,
                textTransform: 'capitalize',
              }}
            >
              {t}
              {t === 'evidence' && evidence.length > 0 && (
                <span className="nav-badge" style={{ marginLeft: 6 }}>{evidence.length}</span>
              )}
              {t === 'escalations' && escalations.length > 0 && (
                <span className="nav-badge" style={{ marginLeft: 6 }}>{escalations.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}

        {/* ─── Overview ─── */}
        {tab === 'overview' && (
          <div className="animate-in">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon primary">📄</div>
                <div className="stat-value">{evidence.length}</div>
                <div className="stat-label">Evidence Files</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon warning">💳</div>
                <div className="stat-value">{transactions.length}</div>
                <div className="stat-label">Transactions</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon error">🚨</div>
                <div className="stat-value">{escalations.length}</div>
                <div className="stat-label">Escalations</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon success">📊</div>
                <div className="stat-value">{timeline.length}</div>
                <div className="stat-label">Timeline Events</div>
              </div>
            </div>

            {/* Quick status update */}
            <div className="card" style={{ marginTop: 'var(--space-6)' }}>
              <div className="card-header">
                <h3 className="card-title">Update Status</h3>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {['active', 'evidence_review', 'awaiting_approval', 'resolved', 'closed'].map((s) => (
                  <button
                    key={s}
                    className={`btn btn-sm ${caseData.status === s ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={async () => {
                      await updateCase(caseId, { status: s });
                      loadData();
                    }}
                  >
                    {s.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── Timeline ─── */}
        {tab === 'timeline' && (
          <div className="animate-in">
            {timeline.length === 0 ? (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-state-icon">📋</div>
                  <div className="empty-state-title">No events yet</div>
                  <div className="empty-state-desc">Upload evidence or add transactions to see activity.</div>
                </div>
              </div>
            ) : (
              <div className="timeline">
                {timeline.map((entry, i) => (
                  <div key={i} className="timeline-entry" style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className={`timeline-dot ${entry.event_type}`} />
                    <div className="timeline-time">
                      {new Date(entry.timestamp).toLocaleString()}
                      {entry.actor && (
                        <span style={{ marginLeft: 8, color: 'var(--text-accent)' }}>
                          [{entry.actor}]
                        </span>
                      )}
                    </div>
                    <div className="timeline-title">{entry.title}</div>
                    {entry.description && (
                      <div className="timeline-desc">{entry.description}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Evidence ─── */}
        {tab === 'evidence' && (
          <div className="animate-in">
            {/* Upload Zone */}
            <label className="dropzone" style={{ marginBottom: 'var(--space-6)', display: 'block' }}>
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                accept="image/*,.pdf,.doc,.docx,.txt"
              />
              <div className="dropzone-icon">{uploading ? '⏳' : '📤'}</div>
              <div className="dropzone-text">
                {uploading ? 'Uploading...' : 'Click to upload evidence files'}
              </div>
              <div className="dropzone-hint">
                PDF, images, documents — max 50MB per file
              </div>
            </label>

            {/* Evidence List */}
            {evidence.length > 0 && (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>File</th>
                      <th>Type</th>
                      <th>Size</th>
                      <th>Status</th>
                      <th>OCR</th>
                      <th>Uploaded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evidence.map((ev) => (
                      <tr key={ev.id}>
                        <td style={{ fontWeight: 500 }}>{ev.original_filename || 'Unknown'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {ev.content_type || '—'}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                          {ev.file_size_bytes
                            ? `${(ev.file_size_bytes / 1024).toFixed(1)} KB`
                            : '—'}
                        </td>
                        <td>
                          <span className={`badge badge-${ev.validation_status === 'valid' ? 'resolved' : ev.validation_status === 'duplicate' ? 'review' : 'draft'}`}>
                            {ev.validation_status}
                          </span>
                        </td>
                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-secondary)' }}>
                          {ev.ocr_extracted_text ? ev.ocr_extracted_text.slice(0, 60) + '...' : '—'}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {new Date(ev.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── Transactions ─── */}
        {tab === 'transactions' && (
          <div className="animate-in">
            {/* Add Transaction Form */}
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
              <div className="card-header">
                <h3 className="card-title">Add Transaction</h3>
              </div>
              <form onSubmit={handleAddTransaction}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr 1fr', gap: 'var(--space-3)', alignItems: 'end' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Amount *</label>
                    <input className="form-input" name="amount" type="number" step="0.01" required placeholder="0.00" />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Currency</label>
                    <select className="form-select" name="currency" defaultValue="INR">
                      <option value="INR">INR</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Order Ref</label>
                    <input className="form-input" name="order_reference" placeholder="ORD-12345" />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ height: 42 }}>
                    ➕ Add
                  </button>
                </div>
              </form>
            </div>

            {/* Transaction List */}
            {transactions.length > 0 && (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Amount</th>
                      <th>Order Ref</th>
                      <th>Payment Method</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                          {tx.currency} {tx.amount.toLocaleString()}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                          {tx.order_reference || '—'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {tx.payment_method || '—'}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {tx.transaction_at
                            ? new Date(tx.transaction_at).toLocaleDateString()
                            : new Date(tx.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── Escalations ─── */}
        {tab === 'escalations' && (
          <div className="animate-in">
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
              <div className="card-header">
                <h3 className="card-title">Escalation Channels</h3>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--space-5)' }}>
                If merchant support hasn&apos;t resolved your dispute, escalate through official channels.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
                {ESCALATION_CHANNELS.map((ch) => (
                  <button
                    key={ch.value}
                    className="btn btn-secondary"
                    style={{ justifyContent: 'flex-start', padding: 'var(--space-4)' }}
                    onClick={() => handleEscalate(ch.value)}
                  >
                    🚨 {ch.label}
                  </button>
                ))}
              </div>
            </div>

            {escalations.length > 0 && (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Channel</th>
                      <th>Status</th>
                      <th>Reference</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {escalations.map((esc) => (
                      <tr key={esc.id}>
                        <td style={{ fontWeight: 500 }}>
                          {ESCALATION_CHANNELS.find(c => c.value === esc.channel)?.label || esc.channel}
                        </td>
                        <td>
                          <span className={`badge badge-${esc.status === 'submitted' ? 'active' : esc.status === 'resolved' ? 'resolved' : 'draft'}`}>
                            {esc.status}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                          {esc.reference || '—'}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {new Date(esc.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default function CaseDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="page-content">
          <div className="skeleton" style={{ height: 200, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 300 }} />
        </div>
      }
    >
      <CaseDetailPageContent />
    </Suspense>
  );
}
