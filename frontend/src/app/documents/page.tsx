'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import { useAuth } from '@/lib/auth-context';
import {
  listCases,
  generateDocument,
  type CaseSummary,
  type GeneratedDocument,
} from '@/lib/api';
import {
  FileText,
  Download,
  Copy,
  Check,
  Printer,
  Sparkles,
  ShieldCheck,
  Clock,
  Layers,
} from 'lucide-react';

const DOC_TYPES = [
  {
    type: 'grievance_notice',
    title: 'Formal Legal Notice to GRO',
    desc: 'Statutory 7-day demand notice under CPA 2019 Section 2(47) addressed to Company Grievance Redressal Officer.',
    icon: '📜',
  },
  {
    type: 'events_chronology',
    title: 'Chronological Record of Events',
    desc: 'Timeline of transactions, cancellation attempts, chatbot loops, and statutory counter-assertions.',
    icon: '⏱️',
  },
  {
    type: 'evidence_index',
    title: 'Index of Verified Annexures',
    desc: 'Evidence inventory with cryptographic SHA-256 hashes, file metadata, and OCR extractions.',
    icon: '📑',
  },
  {
    type: 'consumer_complaint',
    title: 'e-Jagriti Formal Complaint Draft',
    desc: 'Judicial complaint draft formatted for e-Daakhil filing before District Consumer Disputes Commission.',
    icon: '⚖️',
  },
];

export default function DocumentGeneratorPage() {
  const { isAuthenticated } = useAuth();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [selectedDocType, setSelectedDocType] = useState<string>('grievance_notice');
  const [customNotes, setCustomNotes] = useState('');
  const [generatedDoc, setGeneratedDoc] = useState<GeneratedDocument | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      listCases().then((cList) => {
        setCases(cList);
        if (cList.length > 0 && !selectedCaseId) {
          setSelectedCaseId(cList[0].id);
        }
      });
    }
  }, [isAuthenticated, selectedCaseId]);

  const handleGenerate = async () => {
    if (!selectedCaseId) return;
    setGenerating(true);
    try {
      const doc = await generateDocument(selectedCaseId, selectedDocType, customNotes || undefined);
      setGeneratedDoc(doc);
    } catch (err: any) {
      alert(err.message || 'Failed to generate document');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!generatedDoc) return;
    navigator.clipboard.writeText(generatedDoc.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const activeCase = cases.find((c) => c.id === selectedCaseId);

  return (
    <>
      <Header title="Document Generator" />
      <div className="page-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Consumer Dispute Document Generator</h1>
            <p className="page-subtitle">
              Assemble legally grounded notices, verified evidence indexes, and e-Jagriti consumer complaint bundles.
              Documents are generated as verified drafts for legal review before submission.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20 }}>
          {/* Controls Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Target Case Selector */}
            <div className="card">
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Select Target Dossier</label>
                <select
                  className="form-select"
                  value={selectedCaseId}
                  onChange={(e) => setSelectedCaseId(e.target.value)}
                >
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.case_number} — {c.merchant_name} (₹{c.requested_amount?.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Document Template Type */}
            <div className="card">
              <div className="card-header" style={{ paddingBottom: 10, marginBottom: 12 }}>
                <span className="card-title">Document Template</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {DOC_TYPES.map((dt) => (
                  <div
                    key={dt.type}
                    onClick={() => setSelectedDocType(dt.type)}
                    style={{
                      padding: 12,
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${
                        selectedDocType === dt.type ? 'var(--brand-primary)' : 'var(--border-subtle)'
                      }`,
                      background:
                        selectedDocType === dt.type
                          ? 'rgba(14, 165, 233, 0.08)'
                          : 'var(--bg-surface-raised)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 16 }}>{dt.icon}</span>
                      <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{dt.title}</strong>
                    </div>
                    <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                      {dt.desc}
                    </p>
                  </div>
                ))}
              </div>

              <div className="form-group" style={{ marginTop: 16, marginBottom: 0 }}>
                <label className="form-label">Custom Clauses / Notes (Optional)</label>
                <textarea
                  className="form-textarea"
                  placeholder="e.g. Include specific account cancellation ticket numbers or bank statement transaction ID..."
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <button
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={generating || !selectedCaseId}
                style={{ width: '100%', marginTop: 16, justifyContent: 'center' }}
              >
                <Sparkles size={15} />
                <span>{generating ? 'Compiling Legal Draft...' : 'Generate Legal Document'}</span>
              </button>
            </div>
          </div>

          {/* Document Preview Column */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 600 }}>
            <div className="card-header">
              <div>
                <span className="card-title">
                  <FileText size={16} /> Legal Document Viewer & Verification
                </span>
                {generatedDoc && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                    Draft Ref: {generatedDoc.document_id} · Case {generatedDoc.case_number}
                  </div>
                )}
              </div>

              {generatedDoc && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
                    {copied ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                    <span>{copied ? 'Copied' : 'Copy Text'}</span>
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={handlePrint}>
                    <Printer size={14} />
                    <span>Print / PDF</span>
                  </button>
                </div>
              )}
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {generatedDoc ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div
                    style={{
                      padding: 10,
                      background: 'var(--warning-bg)',
                      border: '1px solid var(--warning-border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 12,
                      color: 'var(--warning)',
                      marginBottom: 16,
                    }}
                  >
                    ⚠️ <strong>LEGAL NOTICE STATUS:</strong> This document is a generated legal draft prepared for {activeCase?.merchant_name}.
                    Review all factual dates and claim amounts before sending via registered email or e-Daakhil filing.
                  </div>

                  <pre
                    style={{
                      flex: 1,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12.5,
                      lineHeight: 1.6,
                      background: 'var(--bg-surface-raised)',
                      padding: 20,
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      whiteSpace: 'pre-wrap',
                      overflowY: 'auto',
                    }}
                  >
                    {generatedDoc.content}
                  </pre>
                </div>
              ) : (
                <div className="empty-state" style={{ margin: 'auto' }}>
                  <div className="empty-state-icon">
                    <FileText size={28} />
                  </div>
                  <div className="empty-state-title">No Document Generated Yet</div>
                  <div className="empty-state-desc">
                    Select a target dispute dossier and document template on the left, then click &quot;Generate Legal Document&quot;.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
