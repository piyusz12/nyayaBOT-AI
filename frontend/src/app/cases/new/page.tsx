'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { createCase } from '@/lib/api';

const DISPUTE_TYPES = [
  { value: 'subscription_cancellation', label: '🔄 Subscription Cancellation' },
  { value: 'unauthorized_charge', label: '🚫 Unauthorized Charge' },
  { value: 'refund_request', label: '💰 Refund Request' },
  { value: 'service_not_delivered', label: '📦 Service Not Delivered' },
  { value: 'defective_product', label: '🔧 Defective Product' },
  { value: 'billing_error', label: '🧾 Billing Error' },
  { value: 'dark_pattern', label: '🕸️ Dark Pattern' },
  { value: 'other', label: '📝 Other' },
];

const RESOLUTIONS = [
  { value: 'refund_to_original_payment_method', label: 'Full Refund (Original Payment Method)' },
  { value: 'partial_refund', label: 'Partial Refund' },
  { value: 'service_cancellation', label: 'Service / Subscription Cancellation' },
  { value: 'replacement', label: 'Product Replacement' },
  { value: 'compensation', label: 'Compensation / Credit' },
  { value: 'other', label: 'Other' },
];

const JURISDICTIONS = [
  { value: 'IN', label: '🇮🇳 India' },
  { value: 'US', label: '🇺🇸 United States' },
  { value: 'UK', label: '🇬🇧 United Kingdom' },
  { value: 'EU', label: '🇪🇺 European Union' },
];

export default function NewCasePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [merchantName, setMerchantName] = useState('');
  const [merchantWebsite, setMerchantWebsite] = useState('');
  const [jurisdiction, setJurisdiction] = useState('IN');
  const [disputeType, setDisputeType] = useState('');
  const [requestedAmount, setRequestedAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [requestedResolution, setRequestedResolution] = useState('');
  const [acceptStoreCredit, setAcceptStoreCredit] = useState(false);
  const [description, setDescription] = useState('');

  const canProceedStep1 = merchantName.trim() && disputeType;
  const canProceedStep2 = requestedResolution;

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const newCase = await createCase({
        merchant_name: merchantName.trim(),
        merchant_website: merchantWebsite.trim() || undefined,
        jurisdiction,
        dispute_type: disputeType,
        requested_amount: requestedAmount ? parseFloat(requestedAmount) : undefined,
        currency,
        requested_resolution: requestedResolution,
        accept_store_credit: acceptStoreCredit,
        description: description.trim() || undefined,
      });
      router.push(`/cases/${newCase.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create case');
      setSubmitting(false);
    }
  };

  return (
    <>
      <Header title="File New Dispute" />
      <div className="page-content">
        <div className="page-header animate-in">
          <h2 className="page-title">New Dispute Case</h2>
          <p className="page-subtitle">
            Provide details about your consumer dispute. Garuda AI will build your
            evidence dossier and guide you through resolution.
          </p>
        </div>

        {/* Progress Steps */}
        <div
          className="animate-in"
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-8)',
          }}
        >
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 'var(--radius-full)',
                background:
                  s <= step
                    ? 'var(--gradient-primary)'
                    : 'var(--bg-surface-overlay)',
                transition: 'all var(--transition-default)',
              }}
            />
          ))}
        </div>

        {error && (
          <div
            style={{
              background: 'var(--error-bg)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-4)',
              marginBottom: 'var(--space-5)',
              fontSize: 13,
              color: 'var(--error)',
            }}
          >
            {error}
          </div>
        )}

        {/* Step 1: Merchant & Dispute Type */}
        {step === 1 && (
          <div className="card animate-in" style={{ maxWidth: 640 }}>
            <div className="card-header">
              <h3 className="card-title">Step 1 — Merchant & Dispute Details</h3>
              <span className="badge badge-active">1 / 3</span>
            </div>

            <div className="form-group">
              <label className="form-label">Merchant / Company Name *</label>
              <input
                className="form-input"
                placeholder="e.g. Example Subscription Service"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Merchant Website</label>
              <input
                className="form-input"
                placeholder="https://example.com"
                value={merchantWebsite}
                onChange={(e) => setMerchantWebsite(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Jurisdiction *</label>
              <select
                className="form-select"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
              >
                {JURISDICTIONS.map((j) => (
                  <option key={j.value} value={j.value}>
                    {j.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Dispute Type *</label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 'var(--space-2)',
                }}
              >
                {DISPUTE_TYPES.map((dt) => (
                  <button
                    key={dt.value}
                    type="button"
                    onClick={() => setDisputeType(dt.value)}
                    className={`btn ${
                      disputeType === dt.value ? 'btn-primary' : 'btn-secondary'
                    }`}
                    style={{
                      justifyContent: 'flex-start',
                      fontSize: 13,
                    }}
                  >
                    {dt.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-6)' }}>
              <button
                className="btn btn-primary"
                disabled={!canProceedStep1}
                onClick={() => setStep(2)}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Financial & Resolution */}
        {step === 2 && (
          <div className="card animate-in" style={{ maxWidth: 640 }}>
            <div className="card-header">
              <h3 className="card-title">Step 2 — Amount & Resolution</h3>
              <span className="badge badge-active">2 / 3</span>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Disputed Amount</label>
                <input
                  className="form-input"
                  type="number"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  value={requestedAmount}
                  onChange={(e) => setRequestedAmount(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Currency</label>
                <select
                  className="form-select"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="INR">INR ₹</option>
                  <option value="USD">USD $</option>
                  <option value="GBP">GBP £</option>
                  <option value="EUR">EUR €</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Desired Resolution *</label>
              <select
                className="form-select"
                value={requestedResolution}
                onChange={(e) => setRequestedResolution(e.target.value)}
              >
                <option value="">Select a resolution...</option>
                {RESOLUTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                }}
              >
                <input
                  type="checkbox"
                  checked={acceptStoreCredit}
                  onChange={(e) => setAcceptStoreCredit(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--garuda-primary)' }}
                />
                Accept store credit as alternative resolution
              </label>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 'var(--space-6)',
              }}
            >
              <button className="btn btn-ghost" onClick={() => setStep(1)}>
                ← Back
              </button>
              <button
                className="btn btn-primary"
                disabled={!canProceedStep2}
                onClick={() => setStep(3)}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Description & Submit */}
        {step === 3 && (
          <div className="card animate-in" style={{ maxWidth: 640 }}>
            <div className="card-header">
              <h3 className="card-title">Step 3 — Describe Your Dispute</h3>
              <span className="badge badge-active">3 / 3</span>
            </div>

            <div className="form-group">
              <label className="form-label">
                Describe what happened (include dates, amounts, and what you have tried)
              </label>
              <textarea
                className="form-textarea"
                rows={6}
                placeholder="On [date], I was charged ₹X for [service]. I attempted to cancel via [method] but was told [response]. I have screenshots of..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Summary Card */}
            <div
              style={{
                background: 'var(--bg-surface-raised)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-5)',
                marginBottom: 'var(--space-6)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 'var(--space-3)',
                }}
              >
                Summary
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 'var(--space-3)',
                  fontSize: 13,
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Merchant:</span>{' '}
                  {merchantName}
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Type:</span>{' '}
                  {DISPUTE_TYPES.find((d) => d.value === disputeType)?.label}
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Amount:</span>{' '}
                  {requestedAmount ? `${currency} ${requestedAmount}` : 'Not specified'}
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Resolution:</span>{' '}
                  {RESOLUTIONS.find((r) => r.value === requestedResolution)?.label}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 'var(--space-6)',
              }}
            >
              <button className="btn btn-ghost" onClick={() => setStep(2)}>
                ← Back
              </button>
              <button
                className="btn btn-primary btn-lg"
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting ? '⏳ Creating...' : '🚀 File Dispute'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
