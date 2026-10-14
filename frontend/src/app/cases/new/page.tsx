'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { createDossierV1, uploadEvidence, type DossierV1Payload } from '@/lib/api';
import {
  FolderPlus,
  ArrowRight,
  ArrowLeft,
  Upload,
  CheckCircle,
  AlertCircle,
  FileText,
  X,
  CreditCard,
  Building,
  ShieldAlert,
} from 'lucide-react';

interface StagedFile {
  file: File;
  id: string;
}

export default function CreateDossierPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Step 1: Merchant & Transaction
  const [merchantName, setMerchantName] = useState('');
  const [merchantCin, setMerchantCin] = useState('');
  const [merchantWebsite, setMerchantWebsite] = useState('');
  const [orderId, setOrderId] = useState('');
  const [disputedAmount, setDisputedAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState('');
  const [eMandateRef, setEMandateRef] = useState('');
  const [causeOfActionDate, setCauseOfActionDate] = useState('');
  const [preDebitNoticeReceived, setPreDebitNoticeReceived] = useState(false);
  const [disputeType, setDisputeType] = useState('subscription_cancellation');
  const [description, setDescription] = useState('');

  // Step 2: Evidence files staged
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);

  // Step 3: Resolution preferences
  const [minRefund, setMinRefund] = useState('');
  const [acceptStoreCredit, setAcceptStoreCredit] = useState(false);
  const [acceptProrated, setAcceptProrated] = useState(true);
  const [requireEmandateRevocation, setRequireEmandateRevocation] = useState(true);

  // Validation
  const isStep1Valid = merchantName.trim().length > 0 && parseFloat(disputedAmount) > 0;
  const isStep3Valid = !minRefund || parseFloat(minRefund) >= 0;

  const handleFileDrop = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const newStaged: StagedFile[] = files.map((f) => ({
      file: f,
      id: Math.random().toString(36).substring(7),
    }));
    setStagedFiles((prev) => [...prev, ...newStaged]);
  };

  const removeFile = (id: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Submission to POST /api/v1/dossiers
  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmissionError(null);

    const payload: DossierV1Payload = {
      merchant_name: merchantName.trim(),
      merchant_cin: merchantCin.trim() || undefined,
      merchant_website: merchantWebsite.trim() || undefined,
      order_or_account_id: orderId.trim() || undefined,
      disputed_amount_inr: parseFloat(disputedAmount),
      currency: 'INR',
      transaction_timestamp: transactionDate || undefined,
      e_mandate_ref: eMandateRef.trim() || undefined,
      cause_of_action_date: causeOfActionDate || undefined,
      pre_debit_notice_received: preDebitNoticeReceived,
      dispute_type: disputeType,
      description: description.trim() || undefined,
      min_acceptable_refund_inr: minRefund ? parseFloat(minRefund) : undefined,
      accept_store_credit: acceptStoreCredit,
      accept_prorated_cancellation: acceptProrated,
      require_emandate_revocation: requireEmandateRevocation,
    };

    try {
      const resp = await createDossierV1(payload);

      // Upload staged evidence files to the created case
      if (stagedFiles.length > 0) {
        for (const item of stagedFiles) {
          try {
            await uploadEvidence(resp.case_id, item.file);
          } catch (e) {
            console.error('Evidence upload failed for file', item.file.name, e);
          }
        }
      }

      router.push(`/cases/${resp.case_id}`);
    } catch (err: any) {
      setSubmissionError(err.message || 'Failed to submit dispute dossier');
      setSubmitting(false);
    }
  };

  return (
    <>
      <Header title="Create Dispute Dossier" />
      <div className="page-content" style={{ maxWidth: 860 }}>
        {/* Title */}
        <div className="page-header">
          <div>
            <h1 className="page-title">New Consumer Dispute Dossier</h1>
            <p className="page-subtitle">
              Construct a verified legal dossier for autonomous counter-agent negotiation and statutory escalation.
            </p>
          </div>
        </div>

        {/* Step Progress Tracker */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[
            { num: 1, label: 'Merchant & Transaction' },
            { num: 2, label: 'Evidence Ingestion' },
            { num: 3, label: 'Resolution Floor' },
            { num: 4, label: 'Review & Verify' },
          ].map((s) => (
            <div
              key={s.num}
              style={{
                flex: 1,
                borderBottom: `3px solid ${
                  s.num === step
                    ? 'var(--brand-primary)'
                    : s.num < step
                    ? 'var(--success)'
                    : 'var(--border-subtle)'
                }`,
                paddingBottom: 8,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: s.num <= step ? 'var(--brand-primary-light)' : 'var(--text-muted)',
                  textTransform: 'uppercase',
                }}
              >
                Step 0{s.num}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: s.num === step ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {submissionError && (
          <div
            style={{
              padding: 12,
              background: 'var(--error-bg)',
              border: '1px solid var(--error-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--error)',
              fontSize: 13,
              marginBottom: 20,
            }}
          >
            {submissionError}
          </div>
        )}

        {/* ── STEP 1: Merchant & Transaction ────────────────────────── */}
        {step === 1 && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <Building size={16} /> Step 1: Merchant & Financial Details
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Merchant Legal Name *</label>
                <input
                  className="form-input"
                  placeholder="e.g. Acme Cloud India Pvt Ltd"
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Merchant CIN (Optional)</label>
                <input
                  className="form-input"
                  placeholder="e.g. U72900DL2021PTC123456"
                  value={merchantCin}
                  onChange={(e) => setMerchantCin(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Order or Account Reference ID</label>
                <input
                  className="form-input"
                  placeholder="e.g. SUB-982144 or INV-2026-09"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Merchant Website</label>
                <input
                  className="form-input"
                  placeholder="https://merchant.com"
                  value={merchantWebsite}
                  onChange={(e) => setMerchantWebsite(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Disputed Amount (INR ₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  placeholder="e.g. 2999.00"
                  value={disputedAmount}
                  onChange={(e) => setDisputedAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">E-Mandate Reference ID (if recurring debit)</label>
                <input
                  className="form-input"
                  placeholder="e.g. UMN-HDFC-991244"
                  value={eMandateRef}
                  onChange={(e) => setEMandateRef(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Transaction Timestamp</label>
                <input
                  type="date"
                  className="form-input"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Cause-of-Action Date (Cancellation Request Date)</label>
                <input
                  type="date"
                  className="form-input"
                  value={causeOfActionDate}
                  onChange={(e) => setCauseOfActionDate(e.target.value)}
                />
              </div>
            </div>

            {/* Pre-debit notice check */}
            <div
              style={{
                marginTop: 8,
                padding: 12,
                background: 'var(--bg-surface-raised)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={preDebitNoticeReceived}
                  onChange={(e) => setPreDebitNoticeReceived(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                <span>
                  <strong>Pre-debit notice received:</strong> Did merchant/bank send an SMS/email notice at least 24 hours prior to debit? (Failure violates RBI Circular DPSS.CO.PD.No.447)
                </span>
              </label>
            </div>

            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label">Dispute Classification</label>
              <select
                className="form-select"
                value={disputeType}
                onChange={(e) => setDisputeType(e.target.value)}
              >
                <option value="subscription_cancellation">Subscription Cancellation / Rogue Renewal</option>
                <option value="dark_pattern">Dark Pattern (Deceptive Design / Confirm-shaming)</option>
                <option value="unauthorized_charge">Unauthorized Automatic Debit</option>
                <option value="refund_request">Refund Request Denied</option>
                <option value="service_not_delivered">Service Not Delivered / Defective Product</option>
                <option value="billing_error">Billing Error / Hidden Surcharges</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
              <button
                className="btn btn-primary"
                disabled={!isStep1Valid}
                onClick={() => setStep(2)}
              >
                <span>Continue to Evidence</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Evidence Upload ───────────────────────────────── */}
        {step === 2 && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <Upload size={16} /> Step 2: Evidence Vault Ingestion
              </span>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Upload invoices, bank statements, cancellation email screenshots, or chatbot chats.
              All files are cryptographically hashed (SHA-256) and parsed with PyMuPDF OCR.
            </p>

            <label
              style={{
                border: '2px dashed var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                padding: '40px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                background: 'rgba(14, 165, 233, 0.03)',
                marginBottom: 20,
              }}
            >
              <Upload size={32} color="var(--brand-primary-light)" style={{ marginBottom: 10 }} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>Click to select evidence documents</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                PDF, PNG, JPG, or TXT (Max 50MB per file)
              </span>
              <input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx"
                onChange={handleFileDrop}
                style={{ display: 'none' }}
              />
            </label>

            {/* Staged file list */}
            {stagedFiles.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {stagedFiles.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'var(--bg-surface-raised)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <FileText size={16} color="var(--brand-primary-light)" />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{item.file.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {(item.file.size / 1024).toFixed(1)} KB · {item.file.type || 'Document'}
                        </div>
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => removeFile(item.id)}
                      style={{ padding: 4 }}
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>
                <ArrowLeft size={15} />
                <span>Back</span>
              </button>
              <button className="btn btn-primary" onClick={() => setStep(3)}>
                <span>Resolution Floor</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Resolution Preferences ───────────────────────── */}
        {step === 3 && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <CreditCard size={16} /> Step 3: Resolution Governance & Floor
              </span>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Specify strict boundary conditions for the autonomous counter-agent. The agent will never
              compromise below your minimum acceptable refund without explicit HITL approval.
            </p>

            <div className="form-group">
              <label className="form-label">Minimum Acceptable Cash Refund (INR ₹)</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                placeholder={`Default: ₹${disputedAmount || '0.00'} (Full Refund)`}
                value={minRefund}
                onChange={(e) => setMinRefund(e.target.value)}
              />
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                If merchant offers less than this amount, the session automatically flags a Human Approval Gate.
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={acceptStoreCredit}
                  onChange={(e) => setAcceptStoreCredit(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                <span>Accept merchant wallet / store credit as alternative resolution</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={acceptProrated}
                  onChange={(e) => setAcceptProrated(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                <span>Permit prorated deduction for actual verified days of service consumed</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={requireEmandateRevocation}
                  onChange={(e) => setRequireEmandateRevocation(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                <span>Require mandatory e-mandate revocation and written confirmation of zero future debits</span>
              </label>
            </div>

            <div className="form-group" style={{ marginTop: 20 }}>
              <label className="form-label">Dispute Narrative (Background Context for AI Agent)</label>
              <textarea
                className="form-textarea"
                placeholder="Explain what happened: cancellation attempts, automated deflections, dates, and merchant responses..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
              <button className="btn btn-ghost" onClick={() => setStep(2)}>
                <ArrowLeft size={15} />
                <span>Back</span>
              </button>
              <button
                className="btn btn-primary"
                disabled={!isStep3Valid}
                onClick={() => setStep(4)}
              >
                <span>Review & Verify</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Review and Submit ──────────────────────────────── */}
        {step === 4 && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <CheckCircle size={16} /> Step 4: Review & Legal Verification
              </span>
            </div>

            <div
              style={{
                background: 'var(--bg-surface-raised)',
                padding: 16,
                borderRadius: 'var(--radius-md)',
                marginBottom: 20,
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
                Dossier Summary
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Target Merchant:</span>{' '}
                  <strong>{merchantName}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Disputed Claim:</span>{' '}
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>₹{parseFloat(disputedAmount).toLocaleString('en-IN')}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Classification:</span>{' '}
                  <span>{disputeType.replace(/_/g, ' ')}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Resolution Floor:</span>{' '}
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    ₹{minRefund ? parseFloat(minRefund).toLocaleString() : disputedAmount}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Pre-Debit Notice:</span>{' '}
                  <span style={{ color: preDebitNoticeReceived ? 'var(--text-secondary)' : 'var(--error)' }}>
                    {preDebitNoticeReceived ? 'Received' : 'NOT Received (RBI Non-compliance)'}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Evidence Staged:</span>{' '}
                  <span>{stagedFiles.length} file(s)</span>
                </div>
              </div>
            </div>

            <div
              style={{
                padding: 12,
                background: 'rgba(14, 165, 233, 0.08)',
                border: '1px solid rgba(14, 165, 233, 0.25)',
                borderRadius: 'var(--radius-md)',
                fontSize: 12.5,
                color: 'var(--text-secondary)',
                marginBottom: 24,
              }}
            >
              ⚖️ Upon creation, this dossier will be verified against the Consumer Protection Act, 2019
              and registered for autonomous counter-agent live session execution.
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn btn-ghost" onClick={() => setStep(3)}>
                <ArrowLeft size={15} />
                <span>Back</span>
              </button>
              <button
                className="btn btn-primary btn-lg"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Creating Dossier...' : '🚀 Submit & Initialize Dossier'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
