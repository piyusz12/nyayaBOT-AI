'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { useAuth } from '@/lib/auth-context';
import {
  getCase,
  getDossier,
  getTimeline,
  listEvidence,
  listTransactions,
  listEscalations,
  uploadEvidence,
  updateCase,
  searchLegalProvisions,
  type CaseDetail,
  type DossierData,
  type TimelineEntry,
  type EvidenceItem,
  type TransactionItem,
  type EscalationItem,
  type LegalProvision,
} from '@/lib/api';
import {
  FolderKanban,
  FileText,
  Clock,
  ShieldCheck,
  Scale,
  Bot,
  AlertTriangle,
  Upload,
  ExternalLink,
  ChevronRight,
  Eye,
  CheckCircle,
  Hash,
} from 'lucide-react';

const TABS = ['overview', 'evidence', 'legal_analysis', 'audit_history', 'transactions'] as const;
type Tab = (typeof TABS)[number];

function CaseDetailWorkspace() {
  const params = useParams();
  const caseId = params.id as string;
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [dossier, setDossier] = useState<DossierData | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [escalations, setEscalations] = useState<EscalationItem[]>([]);
  const [legalProvisions, setLegalProvisions] = useState<LegalProvision[]>([]);

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedOcrText, setSelectedOcrText] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [c, d, t, ev, tx, esc, leg] = await Promise.all([
        getCase(caseId),
        getDossier(caseId).catch(() => null),
        getTimeline(caseId),
        listEvidence(caseId),
        listTransactions(caseId),
        listEscalations(caseId),
        searchLegalProvisions().catch(() => ({ total: 0, results: [] })),
      ]);
      setCaseData(c);
      setDossier(d);
      setTimeline(t.entries);
      setEvidenceList(ev);
      setTransactions(tx);
      setEscalations(esc);
      setLegalProvisions(leg.results);
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
    if (!e.target.files) return;
    setUploading(true);
    try {
      for (const file of Array.from(e.target.files)) {
        await uploadEvidence(caseId, file);
      }
      const updatedEv = await listEvidence(caseId);
      setEvidenceList(updatedEv);
      const updatedTl = await getTimeline(caseId);
      setTimeline(updatedTl.entries);
    } catch {
      alert('Evidence upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <>
        <Header title="Dossier Workspace" />
        <div className="page-content">
          <div className="skeleton" style={{ height: 140, marginBottom: 20 }} />
          <div className="skeleton" style={{ height: 400 }} />
        </div>
      </>
    );
  }

  if (!caseData) return null;

  return (
    <>
      <Header title={`Dossier ${caseData.case_number}`} />
      <div className="page-content">
        {/* Dossier Header Banner */}
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {caseData.merchant_name}
                </h1>
                <span className={`badge badge-${caseData.status}`}>{caseData.status}</span>
              </div>
              <div style={{ display: 'flex', gap: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
                <span>
                  Dossier Ref: <strong style={{ fontFamily: 'var(--font-mono)' }}>{caseData.case_number}</strong>
                </span>
                <span>Type: {caseData.dispute_type.replace(/_/g, ' ')}</span>
                <span>Jurisdiction: {caseData.jurisdiction} (India)</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Disputed Amount
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--brand-primary-light)' }}>
                  ₹{caseData.requested_amount?.toLocaleString('en-IN') || '0'}
                </div>
              </div>
              <Link href={`/negotiations?case_id=${caseData.id}`} className="btn btn-primary btn-sm">
                <Bot size={15} />
                <span>Launch Agent Session</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: 'var(--space-6)',
          }}
        >
          {TABS.map((t) => (
            <button
              key={t}
              className="btn btn-ghost btn-sm"
              onClick={() => setActiveTab(t)}
              style={{
                borderBottom: activeTab === t ? '2px solid var(--brand-primary)' : '2px solid transparent',
                borderRadius: 0,
                color: activeTab === t ? 'var(--brand-primary-light)' : 'var(--text-secondary)',
                fontWeight: activeTab === t ? 600 : 400,
                textTransform: 'capitalize',
                padding: '8px 16px',
              }}
            >
              {t.replace(/_/g, ' ')}
              {t === 'evidence' && evidenceList.length > 0 && (
                <span className="nav-badge" style={{ marginLeft: 6 }}>
                  {evidenceList.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── TAB 1: Overview ───────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-6)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Case Narrative */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Dispute Narrative & Facts</span>
                </div>
                <p style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  {caseData.description || 'No detailed narrative entered during intake.'}
                </p>
                {dossier?.evidence_summary && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 10,
                      background: 'var(--bg-surface-raised)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 12.5,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <strong>Intake Summary:</strong> {dossier.evidence_summary}
                  </div>
                )}
              </div>

              {/* Status Controls */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Dossier Lifecycle Status</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['active', 'evidence_review', 'awaiting_approval', 'escalated', 'resolved', 'closed'].map((st) => (
                    <button
                      key={st}
                      className={`btn btn-sm ${caseData.status === st ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={async () => {
                        await updateCase(caseData.id, { status: st });
                        loadData();
                      }}
                    >
                      {st.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Summary Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Resolution Constraints</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Store Credit:</span>{' '}
                    <strong>{caseData.accept_store_credit ? 'Acceptable' : 'Refused'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Requested Resolution:</span>{' '}
                    <span>{caseData.requested_resolution || 'Full Refund'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Jurisdiction:</span>{' '}
                    <span>{caseData.jurisdiction} (Consumer Protection Act, 2019)</span>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">Quick Actions</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Link href={`/documents?case_id=${caseData.id}`} className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }}>
                    <FileText size={14} />
                    <span>Generate Grievance Notice</span>
                  </Link>
                  <Link href={`/negotiations?case_id=${caseData.id}`} className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }}>
                    <Bot size={14} />
                    <span>Open Live Negotiation Session</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: Evidence Vault ─────────────────────────────────── */}
        {activeTab === 'evidence' && (
          <div>
            {/* Upload Zone */}
            <label
              style={{
                border: '2px dashed var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                padding: '30px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
                background: 'rgba(14, 165, 233, 0.03)',
                marginBottom: 20,
              }}
            >
              <Upload size={28} color="var(--brand-primary-light)" style={{ marginBottom: 8 }} />
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>
                {uploading ? 'Processing & Ingesting Evidence...' : 'Click to upload evidence documents or invoices'}
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                PDF, images, receipts (Auto SHA-256 hash & OCR extraction)
              </span>
              <input type="file" multiple onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>

            {/* OCR Extracted Text Preview Modal / Panel */}
            {selectedOcrText && (
              <div className="card" style={{ marginBottom: 20, border: '1px solid var(--border-hover)' }}>
                <div className="card-header">
                  <span className="card-title">
                    <FileText size={15} /> OCR Extracted Content
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedOcrText(null)}>
                    Close
                  </button>
                </div>
                <pre
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    background: 'var(--bg-surface-raised)',
                    padding: 14,
                    borderRadius: 'var(--radius-md)',
                    maxHeight: 250,
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    color: 'var(--text-primary)',
                  }}
                >
                  {selectedOcrText}
                </pre>
              </div>
            )}

            {/* Evidence Table */}
            {evidenceList.length === 0 ? (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <ShieldCheck size={24} />
                  </div>
                  <div className="empty-state-title">No Evidence Uploaded</div>
                  <div className="empty-state-desc">Upload receipts, invoices, or cancellation email screen captures.</div>
                </div>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Original File</th>
                      <th>Type</th>
                      <th>Size</th>
                      <th>SHA-256 Checksum</th>
                      <th>Validation</th>
                      <th>OCR Extracted</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evidenceList.map((ev) => (
                      <tr key={ev.id}>
                        <td style={{ fontWeight: 600 }}>{ev.original_filename || 'Evidence File'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ev.content_type || 'binary'}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                          {ev.file_size_bytes ? `${(ev.file_size_bytes / 1024).toFixed(1)} KB` : '—'}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                          {ev.sha256.substring(0, 14)}...
                        </td>
                        <td>
                          <span className={`badge badge-${ev.validation_status === 'valid' ? 'valid' : 'review'}`}>
                            {ev.validation_status}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {ev.ocr_extracted_text ? `${ev.ocr_extracted_text.slice(0, 50)}...` : 'None extracted'}
                        </td>
                        <td>
                          {ev.ocr_extracted_text && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setSelectedOcrText(ev.ocr_extracted_text!)}
                            >
                              <Eye size={12} />
                              <span>View OCR</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: Legal Analysis ─────────────────────────────────── */}
        {activeTab === 'legal_analysis' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                Applicable Statutory Provisions & CCPA Dark Pattern Classifications
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Verified legal provisions grounded for this dispute category ({caseData.dispute_type}).
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
              {legalProvisions.map((prov) => (
                <div key={prov.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {prov.source_name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--brand-primary-light)', fontFamily: 'var(--font-mono)' }}>
                        {prov.section_or_annexure}
                      </div>
                    </div>
                    <span className={`badge badge-${prov.severity === 'critical' ? 'failed' : 'review'}`}>
                      {prov.severity}
                    </span>
                  </div>

                  <div
                    style={{
                      background: 'var(--bg-surface-raised)',
                      padding: 10,
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 12,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-secondary)',
                      marginBottom: 10,
                      lineHeight: 1.5,
                    }}
                  >
                    &ldquo;{prov.retrieved_text}&rdquo;
                  </div>

                  <p style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.45 }}>
                    <strong>Relevance:</strong> {prov.relevance_explanation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 4: Audit History ──────────────────────────────────── */}
        {activeTab === 'audit_history' && (
          <div>
            {timeline.length === 0 ? (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <Clock size={24} />
                  </div>
                  <div className="empty-state-title">No Audit Events</div>
                  <div className="empty-state-desc">All system actions and decisions will appear here chronologically.</div>
                </div>
              </div>
            ) : (
              <div className="card">
                <div className="table-wrapper" style={{ border: 'none' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Event Type</th>
                        <th>Actor</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timeline.map((entry, idx) => (
                        <tr key={idx}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                            {new Date(entry.timestamp).toLocaleString()}
                          </td>
                          <td style={{ fontWeight: 600 }}>{entry.title}</td>
                          <td>
                            <span style={{ fontSize: 11, color: 'var(--brand-primary-light)', textTransform: 'uppercase' }}>
                              {entry.actor || 'system'}
                            </span>
                          </td>
                          <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                            {entry.description || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 5: Transactions ──────────────────────────────────── */}
        {activeTab === 'transactions' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Disputed Financial Transactions</span>
            </div>
            {transactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: 13 }}>
                No separate transaction rows logged. Primary disputed amount: ₹{caseData.requested_amount?.toLocaleString()}
              </div>
            ) : (
              <div className="table-wrapper" style={{ border: 'none' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Amount</th>
                      <th>Order Reference</th>
                      <th>Payment Method</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                          {tx.currency} {tx.amount.toLocaleString()}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{tx.order_reference || '—'}</td>
                        <td>{tx.payment_method || 'Card / UPI'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {tx.transaction_at ? new Date(tx.transaction_at).toLocaleDateString() : '—'}
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
    <Suspense fallback={<div className="page-content">Loading dossier workspace...</div>}>
      <CaseDetailWorkspace />
    </Suspense>
  );
}
