'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { useAuth } from '@/lib/auth-context';
import { listCases, getAuditTrail, type AuditItem } from '@/lib/api';

export default function AuditPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<(AuditItem & { case_number: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (isAuthenticated) loadAudit();
  }, [isAuthenticated, isLoading, router]);

  const loadAudit = async () => {
    try {
      const cases = await listCases();
      const allEvents: (AuditItem & { case_number: string })[] = [];

      for (const c of cases) {
        const trail = await getAuditTrail(c.id);
        allEvents.push(...trail.map((e) => ({ ...e, case_number: c.case_number })));
      }

      allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setEvents(allEvents);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || !isAuthenticated) return null;

  return (
    <>
      <Header title="Audit Log" />
      <div className="page-content">
        <div className="page-header animate-in">
          <h2 className="page-title">Audit Trail</h2>
          <p className="page-subtitle">
            Append-only record of all system events and user actions
          </p>
        </div>

        {loading ? (
          <div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton" style={{ height: 44, marginBottom: 8 }} />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="card animate-in">
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">No audit events</div>
              <div className="empty-state-desc">
                Audit events will appear here once you start creating and managing cases.
              </div>
            </div>
          </div>
        ) : (
          <div className="table-wrapper animate-in">
            <table className="table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Case</th>
                  <th>Event</th>
                  <th>Actor</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(e.timestamp).toLocaleString()}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {e.case_number}
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      {e.event_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: 'var(--text-accent)' }}>
                        {e.actor || 'system'}
                      </span>
                    </td>
                    <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {e.payload}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
