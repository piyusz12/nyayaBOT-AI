'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { useAuth } from '@/lib/auth-context';
import {
  listCases,
  listEscalations,
  createEscalation,
  type CaseSummary,
  type EscalationItem,
} from '@/lib/api';
import {
  AlertTriangle,
  Building,
  Mail,
  Scale,
  Landmark,
  PhoneCall,
  CheckCircle,
  Clock,
  PlusCircle,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

interface EscalationPathway {
  channel: string;
  name: string;
  targetAuthority: string;
  sla: string;
  icon: any;
  description: string;
  color: string;
  legalBasis: string;
}

const ESCALATION_PATHWAYS: EscalationPathway[] = [
  {
    channel: 'grievance_officer',
    name: 'Grievance Redressal Officer (GRO)',
    targetAuthority: 'Company Designated Grievance Officer',
    sla: '48hr Ack · 15 Day Redressal',
    icon: Mail,
    description: 'Statutory Level 2 escalation to the officially notified Grievance Officer under E-Commerce Rules, 2020.',
    color: 'var(--brand-primary-light)',
    legalBasis: 'Consumer Protection (E-Commerce) Rules, 2020 Rule 5(3)',
  },
  {
    channel: 'nch',
    name: 'National Consumer Helpline (NCH / INGRAM)',
    targetAuthority: 'Department of Consumer Affairs, Govt. of India',
    sla: '7-14 Business Days',
    icon: PhoneCall,
    description: 'Prepares structured grievance dossier for submission via the NCH portal (1915 helpline).',
    color: 'var(--warning)',
    legalBasis: 'National Consumer Helpline (INGRAM Portal)',
  },
  {
    channel: 'bank_dispute',
    name: 'Banking Dispute & E-Mandate Revocation',
    targetAuthority: 'Card Issuer / UPI Bank Nodal Officer',
    sla: 'Immediate Revocation · 30 Day Chargeback',
    icon: Landmark,
    description: 'Invokes RBI circular DPSS.CO.PD.No.447 against unauthorized recurring debits without 24-hr pre-debit SMS.',
    color: 'var(--error)',
    legalBasis: 'RBI Circular DPSS.CO.PD.No.447/02.14.003/2019-20',
  },
  {
    channel: 'e_jagriti',
    name: 'e-Jagriti Consumer Commission Filing',
    targetAuthority: 'District Consumer Disputes Redressal Commission',
    sla: 'Judicial Notice Issuance',
    icon: Scale,
    description: 'Generates formal complaint bundle in Form I format ready for verified e-Daakhil filing.',
    color: 'var(--success)',
    legalBasis: 'Consumer Protection Act, 2019 Section 35 (e-Daakhil)',
  },
];

export default function EscalationsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [escalations, setEscalations] = useState<EscalationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingChannel, setCreatingChannel] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const caseList = await listCases();
      setCases(caseList);
      if (caseList.length > 0) {
        const targetId = selectedCaseId || caseList[0].id;
        setSelectedCaseId(targetId);
        const escList = await listEscalations(targetId);
        setEscalations(escList);
      }
    } catch {
      setEscalations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadData();
  }, [isAuthenticated, selectedCaseId]);

  const handleSelectCase = async (caseId: string) => {
    setSelectedCaseId(caseId);
    setLoading(true);
    try {
      const escList = await listEscalations(caseId);
      setEscalations(escList);
    } catch {
      setEscalations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateEscalation = async (channel: string) => {
    if (!selectedCaseId) return;
    const pathway = ESCALATION_PATHWAYS.find((p) => p.channel === channel);
    const confirmEscalate = confirm(
      `Initiate formal escalation via ${pathway?.name}?\n\nThis will generate an escalation packet and log a statutory event in the case audit trail.`
    );
    if (!confirmEscalate) return;

    setCreatingChannel(channel);
    try {
      await createEscalation(
        selectedCaseId,
        channel,
        JSON.stringify({
          authority: pathway?.targetAuthority,
          sla: pathway?.sla,
          legalBasis: pathway?.legalBasis,
          initiated_at: new Date().toISOString(),
        })
      );
      await handleSelectCase(selectedCaseId);
    } catch (err: any) {
      alert(err.message || 'Failed to initiate escalation');
    } finally {
      setCreatingChannel(null);
    }
  };

  const activeCase = cases.find((c) => c.id === selectedCaseId);

  return (
    <>
      <Header title="Escalation Control Center" />
      <div className="page-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Escalation Control Center</h1>
            <p className="page-subtitle">
              Progressive statutory escalation paths for non-responsive merchants, unfulfilled refund orders,
              and deceptive dark pattern violations.
            </p>
          </div>

          {/* Dossier Selector */}
          {cases.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Target Case:
              </label>
              <select
                className="form-select"
                value={selectedCaseId}
                onChange={(e) => handleSelectCase(e.target.value)}
                style={{ width: 280, padding: '7px 12px', fontSize: 13 }}
              >
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.case_number} — {c.merchant_name} (₹{c.requested_amount?.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Selected Case Context Banner */}
        {activeCase && (
          <div
            style={{
              padding: 14,
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              marginBottom: 24,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Target Merchant:</span>{' '}
              <strong style={{ fontSize: 15, color: 'var(--text-primary)' }}>{activeCase.merchant_name}</strong>
              <span style={{ margin: '0 12px', color: 'var(--border-default)' }}>|</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Dossier:</span>{' '}
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{activeCase.case_number}</span>
            </div>
            <div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Claim:</span>{' '}
              <strong style={{ fontSize: 15, fontFamily: 'var(--font-mono)', color: 'var(--brand-primary-light)' }}>
                ₹{activeCase.requested_amount?.toLocaleString('en-IN') || '0'}
              </strong>
            </div>
          </div>
        )}

        {/* Escalation Channels Grid */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Available Escalation Pathways</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {ESCALATION_PATHWAYS.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.channel} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--bg-surface-raised)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: p.color,
                        }}
                      >
                        <Icon size={18} />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--brand-primary-light)' }}>{p.targetAuthority}</div>
                      </div>
                    </div>

                    <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
                      {p.description}
                    </p>

                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        background: 'var(--bg-surface-raised)',
                        padding: '6px 8px',
                        borderRadius: 4,
                        marginBottom: 14,
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      SLA: {p.sla}
                    </div>
                  </div>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleInitiateEscalation(p.channel)}
                    disabled={creatingChannel === p.channel || !selectedCaseId}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <span>{creatingChannel === p.channel ? 'Generating Packet...' : 'Initiate Escalation'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Escalations for this Case */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Clock size={16} /> Logged Escalation Packets for {activeCase?.case_number}
            </span>
          </div>

          {loading ? (
            <div className="skeleton" style={{ height: 100 }} />
          ) : escalations.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <AlertTriangle size={24} />
              </div>
              <div className="empty-state-title">No Active Escalations Logged</div>
              <div className="empty-state-desc">
                Select an escalation pathway above to generate formal notice packets and statutory references.
              </div>
            </div>
          ) : (
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Channel</th>
                    <th>Status</th>
                    <th>Reference ID</th>
                    <th>Target Authority / Details</th>
                    <th>Initiated At</th>
                  </tr>
                </thead>
                <tbody>
                  {escalations.map((esc) => {
                    let parsed: any = {};
                    try {
                      parsed = JSON.parse(esc.details);
                    } catch {
                      parsed = {};
                    }

                    return (
                      <tr key={esc.id}>
                        <td style={{ fontWeight: 600 }}>
                          {ESCALATION_PATHWAYS.find((p) => p.channel === esc.channel)?.name || esc.channel}
                        </td>
                        <td>
                          <span
                            className={`badge badge-${
                              esc.status === 'submitted'
                                ? 'active'
                                : esc.status === 'resolved'
                                ? 'resolved'
                                : 'draft'
                            }`}
                          >
                            {esc.status}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                          {esc.reference || `ESC-${esc.id.slice(0, 8).toUpperCase()}`}
                        </td>
                        <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                          {parsed.authority || parsed.reason || 'Formal grievance notice prepared'}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {new Date(esc.created_at).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
