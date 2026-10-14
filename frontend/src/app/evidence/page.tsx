'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { useAuth } from '@/lib/auth-context';
import {
  listCases,
  listEvidence,
  uploadEvidence,
  type CaseSummary,
  type EvidenceItem,
} from '@/lib/api';
import {
  ShieldCheck,
  Upload,
  FileText,
  Search,
  Eye,
  Hash,
  ExternalLink,
  Clock,
  Filter,
} from 'lucide-react';

interface EnrichedEvidence extends EvidenceItem {
  case_number: string;
  merchant_name: string;
}

export default function EvidenceVaultPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [allEvidence, setAllEvidence] = useState<EnrichedEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCaseForUpload, setSelectedCaseForUpload] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedOcrText, setSelectedOcrText] = useState<{ name: string; text: string } | null>(null);

  const loadEvidenceVault = async () => {
    try {
      const caseList = await listCases();
      setCases(caseList);
      if (caseList.length > 0 && !selectedCaseForUpload) {
        setSelectedCaseForUpload(caseList[0].id);
      }

      const vaultItems: EnrichedEvidence[] = [];
      for (const c of caseList) {
        try {
          const evList = await listEvidence(c.id);
          for (const ev of evList) {
            vaultItems.push({
              ...ev,
              case_number: c.case_number,
              merchant_name: c.merchant_name,
            });
          }
        } catch {
          // ignore individual error
        }
      }

      setAllEvidence(vaultItems);
    } catch {
      setAllEvidence([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (isAuthenticated) {
      loadEvidenceVault();
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) return null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !selectedCaseForUpload) return;
    setUploading(true);
    try {
      for (const file of Array.from(e.target.files)) {
        await uploadEvidence(selectedCaseForUpload, file);
      }
      await loadEvidenceVault();
    } catch {
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const filteredEvidence = allEvidence.filter((ev) => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return (
      (ev.original_filename && ev.original_filename.toLowerCase().includes(q)) ||
      ev.case_number.toLowerCase().includes(q) ||
      ev.merchant_name.toLowerCase().includes(q) ||
      ev.sha256.toLowerCase().includes(q) ||
      (ev.ocr_extracted_text && ev.ocr_extracted_text.toLowerCase().includes(q))
    );
  });

  return (
    <>
      <Header title="Evidence Vault" />
      <div className="page-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Evidence Vault & Cryptographic Ledger</h1>
            <p className="page-subtitle">
              Centralized repository of all uploaded invoices, payment receipts, cancellation screenshots,
              and OCR-extracted transcripts with SHA-256 provenance tracking.
            </p>
          </div>
        </div>

        {/* Upload Zone */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <span className="card-title">
              <Upload size={16} /> Ingest Evidence to Dossier
            </span>
            {cases.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Target Dossier:</span>
                <select
                  className="form-select"
                  value={selectedCaseForUpload}
                  onChange={(e) => setSelectedCaseForUpload(e.target.value)}
                  style={{ width: 250, padding: '5px 10px', fontSize: 12.5 }}
                >
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.case_number} — {c.merchant_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <label
            style={{
              border: '2px dashed var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: 'pointer',
              background: 'rgba(14, 165, 233, 0.02)',
            }}
          >
            <Upload size={24} color="var(--brand-primary-light)" style={{ marginBottom: 6 }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {uploading ? 'Ingesting and executing OCR...' : 'Click to upload evidence documents to selected dossier'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Max 50MB per file · PDF, PNG, JPG, TXT
            </span>
            <input type="file" multiple onChange={handleUpload} style={{ display: 'none' }} />
          </label>
        </div>

        {/* OCR Preview Panel */}
        {selectedOcrText && (
          <div className="card" style={{ marginBottom: 20, border: '1px solid var(--border-hover)' }}>
            <div className="card-header">
              <span className="card-title">
                <FileText size={15} /> OCR Extracted Transcript: {selectedOcrText.name}
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
              {selectedOcrText.text}
            </pre>
          </div>
        )}

        {/* Filter and Vault Table */}
        <div className="card">
          <div className="card-header">
            <div>
              <span className="card-title">
                <ShieldCheck size={16} /> All Verified Evidence Files ({filteredEvidence.length})
              </span>
            </div>
            <div style={{ position: 'relative', width: 280 }}>
              <input
                type="text"
                placeholder="Search file, hash, or text..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="form-input"
                style={{ padding: '6px 12px 6px 30px', fontSize: 12.5 }}
              />
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
            </div>
          </div>

          {loading ? (
            <div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton" style={{ height: 48, marginBottom: 8 }} />
              ))}
            </div>
          ) : filteredEvidence.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <ShieldCheck size={28} />
              </div>
              <div className="empty-state-title">Evidence Vault Empty</div>
              <div className="empty-state-desc">Upload supporting documentation for your dispute cases.</div>
            </div>
          ) : (
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Filename</th>
                    <th>Dossier / Merchant</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>SHA-256 Checksum</th>
                    <th>Validation</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvidence.map((ev) => (
                    <tr key={ev.id}>
                      <td style={{ fontWeight: 600 }}>{ev.original_filename || 'Evidence File'}</td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--brand-primary-light)' }}>
                          {ev.case_number}
                        </span>{' '}
                        · <span style={{ color: 'var(--text-secondary)' }}>{ev.merchant_name}</span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ev.content_type || 'binary'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {ev.file_size_bytes ? `${(ev.file_size_bytes / 1024).toFixed(1)} KB` : '—'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                        {ev.sha256.substring(0, 16)}...
                      </td>
                      <td>
                        <span className={`badge badge-${ev.validation_status === 'valid' ? 'valid' : 'review'}`}>
                          {ev.validation_status}
                        </span>
                      </td>
                      <td>
                        {ev.ocr_extracted_text && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() =>
                              setSelectedOcrText({
                                name: ev.original_filename || 'Evidence',
                                text: ev.ocr_extracted_text!,
                              })
                            }
                          >
                            <Eye size={12} />
                            <span>OCR Text</span>
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
      </div>
    </>
  );
}
