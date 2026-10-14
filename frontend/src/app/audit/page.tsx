'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import { useAuth } from '@/lib/auth-context';
import { listCases, getAuditTrail, type AuditItem } from '@/lib/api';
import {
  History,
  Search,
  Filter,
  Eye,
  CheckCircle,
  Clock,
  Shield,
  FileText,
} from 'lucide-react';

interface EnrichedAuditEvent extends AuditItem {
  case_number: string;
}

export default function AuditPage() {
  const { isAuthenticated } = useAuth();
  const [events, setEvents] = useState<EnrichedAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actorFilter, setActorFilter] = useState('all');
  const [selectedPayload, setSelectedPayload] = useState<{ id: string; payload: string } | null>(null);

  const loadAudit = async () => {
    try {
      const cases = await listCases();
      const allEvents: EnrichedAuditEvent[] = [];

      for (const c of cases) {
        try {
          const trail = await getAuditTrail(c.id);
          allEvents.push(...trail.map((e) => ({ ...e, case_number: c.case_number })));
        } catch {
          // ignore
        }
      }

      allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setEvents(allEvents);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadAudit();
  }, [isAuthenticated]);

  const filteredEvents = events.filter((e) => {
    if (actorFilter !== 'all' && (e.actor || 'system') !== actorFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        e.case_number.toLowerCase().includes(q) ||
        e.event_type.toLowerCase().includes(q) ||
        e.payload.toLowerCase().includes(q) ||
        (e.actor && e.actor.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <>
      <Header title="Audit Trail" />
      <div className="page-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Tamper-Evident Audit Trail</h1>
            <p className="page-subtitle">
              Append-only, verifiable historical log of all operator decisions, autonomous agent actions,
              evidence ingests, and statutory escalations for compliance readiness.
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { key: 'all', label: `All Actors (${events.length})` },
                { key: 'agent', label: 'AI Agent' },
                { key: 'user', label: 'Operator / User' },
                { key: 'system', label: 'System Guardrails' },
              ].map((f) => (
                <button
                  key={f.key}
                  className={`btn btn-sm ${actorFilter === f.key ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setActorFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative', width: 280 }}>
              <input
                type="text"
                placeholder="Search events, case #, payload..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
                style={{ padding: '6px 12px 6px 32px', fontSize: 13 }}
              />
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
            </div>
          </div>
        </div>

        {/* Selected Payload Inspector */}
        {selectedPayload && (
          <div className="card" style={{ marginBottom: 20, border: '1px solid var(--border-hover)' }}>
            <div className="card-header">
              <span className="card-title">
                <FileText size={15} /> Event Payload Inspection
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedPayload(null)}>
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
                maxHeight: 220,
                overflowY: 'auto',
                color: 'var(--text-primary)',
              }}
            >
              {(() => {
                try {
                  return JSON.stringify(JSON.parse(selectedPayload.payload), null, 2);
                } catch {
                  return selectedPayload.payload;
                }
              })()}
            </pre>
          </div>
        )}

        {/* Audit Table */}
        {loading ? (
          <div>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton" style={{ height: 48, marginBottom: 8 }} />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">
                <History size={28} />
              </div>
              <div className="empty-state-title">No Audit Events Logged</div>
              <div className="empty-state-desc">Audit logs will record automatically as case actions occur.</div>
            </div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Dossier Ref</th>
                  <th>Event Classification</th>
                  <th>Actor</th>
                  <th>Event Payload Summary</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(e.timestamp).toLocaleString()}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600 }}>
                      {e.case_number}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {e.event_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color:
                            e.actor === 'agent'
                              ? 'var(--brand-primary-light)'
                              : e.actor === 'user'
                              ? 'var(--success)'
                              : 'var(--text-muted)',
                        }}
                      >
                        {e.actor || 'system'}
                      </span>
                    </td>
                    <td style={{ maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {e.payload}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedPayload({ id: e.id, payload: e.payload })}
                        style={{ padding: '3px 8px', fontSize: 11.5 }}
                      >
                        <Eye size={12} />
                        <span>Inspect</span>
                      </button>
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
