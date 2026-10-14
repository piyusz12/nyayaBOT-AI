'use client';

import { useRouter } from 'next/navigation';
import Header from '@/components/Header';

export default function EscalationsOverviewPage() {
  const router = useRouter();

  const stages = [
    {
      level: 'Level 1',
      title: 'Merchant Chat Adapter',
      desc: 'Direct cancellation or refund request through merchant support.',
      icon: '💬',
      color: 'var(--info)',
    },
    {
      level: 'Level 2',
      title: 'Grievance Officer Email',
      desc: 'Formal internal complaint with evidence to the company grievance officer.',
      icon: '📧',
      color: 'var(--warning)',
    },
    {
      level: 'Level 3',
      title: 'Further Company Escalation',
      desc: 'Escalation package with documented response deadline.',
      icon: '📋',
      color: 'var(--garuda-accent)',
    },
    {
      level: 'External',
      title: 'NCH Grievance Workflow',
      desc: 'Prepared grievance for the National Consumer Helpline (1915).',
      icon: '🏛️',
      color: 'var(--garuda-primary)',
    },
    {
      level: 'Financial',
      title: 'Bank / E-Mandate Dispute',
      desc: 'Unauthorized-debit complaint or mandate-revocation guidance.',
      icon: '🏦',
      color: 'var(--error)',
    },
    {
      level: 'Formal',
      title: 'e-Jagriti Complaint Packet',
      desc: 'Indexed evidence bundle and draft complaint for formal filing.',
      icon: '⚖️',
      color: 'var(--success)',
    },
  ];

  return (
    <>
      <Header title="Escalation Channels" />
      <div className="page-content">
        <div className="page-header animate-in">
          <h2 className="page-title">Resolution Pathway</h2>
          <p className="page-subtitle">
            Progressive escalation from merchant support to formal grievance processes. 
            Select a case to initiate an escalation.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 'var(--space-5)',
          }}
        >
          {stages.map((s, i) => (
            <div
              key={s.level}
              className="card animate-in"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 'var(--radius-md)',
                    background: `color-mix(in srgb, ${s.color} 15%, transparent)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                  }}
                >
                  {s.icon}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: s.color,
                      marginBottom: 2,
                    }}
                  >
                    {s.level}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{s.title}</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
