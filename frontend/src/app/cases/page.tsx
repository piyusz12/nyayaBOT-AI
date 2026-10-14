'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { useAuth } from '@/lib/auth-context';
import { listCases, type CaseSummary } from '@/lib/api';
import {
  FolderKanban,
  PlusCircle,
  Search,
  ExternalLink,
  Filter,
  ArrowUpDown,
  Building,
  Bot,
} from 'lucide-react';

const DISPUTE_LABELS: Record<string, string> = {
  subscription_cancellation: 'Subscription Cancellation',
  unauthorized_charge: 'Unauthorized Charge',
  refund_request: 'Refund Request',
  service_not_delivered: 'Service Not Delivered',
  defective_product: 'Defective Product',
  billing_error: 'Billing Error',
  dark_pattern: 'Dark Pattern Trap',
  other: 'General Consumer Dispute',
};

function CasesListContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [sortField, setSortField] = useState<'created_at' | 'requested_amount'>('created_at');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (isAuthenticated) {
      listCases()
        .then(setCases)
        .catch(() => setCases([]))
        .finally(() => setLoading(false));
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) return null;

  // Filter & Search
  let filtered = cases.filter((c) => {
    if (filter !== 'all' && c.status !== filter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        c.merchant_name.toLowerCase().includes(q) ||
        c.case_number.toLowerCase().includes(q) ||
        c.dispute_type.toLowerCase().includes(q) ||
        c.status.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Sorting
  filtered.sort((a, b) => {
    if (sortField === 'requested_amount') {
      const valA = a.requested_amount || 0;
      const valB = b.requested_amount || 0;
      return sortAsc ? valA - valB : valB - valA;
    }
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    return sortAsc ? timeA - timeB : timeB - timeA;
  });

  const statusCounts: Record<string, number> = {};
  cases.forEach((c) => {
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
  });

  return (
    <>
      <Header title="Dispute Dossiers Registry" />
      <div className="page-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Dispute Dossiers Registry</h1>
            <p className="page-subtitle">
              Comprehensive ledger of active consumer claims, legal evidence dossiers, and autonomous agent statuses.
            </p>
          </div>
          <Link href="/cases/new" className="btn btn-primary">
            <PlusCircle size={16} />
            <span>Create Dispute Dossier</span>
          </Link>
        </div>

        {/* Filter & Search Bar */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            {/* Filter chips */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { key: 'all', label: `All (${cases.length})` },
                { key: 'draft', label: `Draft (${statusCounts.draft || 0})` },
                { key: 'active', label: `Active (${statusCounts.active || 0})` },
                { key: 'evidence_review', label: `Review (${statusCounts.evidence_review || 0})` },
                { key: 'awaiting_approval', label: `Awaiting HITL (${statusCounts.awaiting_approval || 0})` },
                { key: 'escalated', label: `Escalated (${statusCounts.escalated || 0})` },
                { key: 'resolved', label: `Resolved (${statusCounts.resolved || 0})` },
              ].map((f) => (
                <button
                  key={f.key}
                  className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div style={{ position: 'relative', width: 280 }}>
              <input
                type="text"
                placeholder="Search merchant, case #..."
                className="form-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ padding: '6px 12px 6px 32px', fontSize: 13 }}
              />
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
            </div>
          </div>
        </div>

        {/* Dossiers Table */}
        {loading ? (
          <div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton" style={{ height: 52, marginBottom: 8 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">
                <FolderKanban size={28} />
              </div>
              <div className="empty-state-title">No Matching Dossiers Found</div>
              <div className="empty-state-desc">
                {searchQuery || filter !== 'all'
                  ? 'No dispute cases matched your active search or filter criteria.'
                  : 'Get started by creating your first consumer dispute dossier.'}
              </div>
              <Link href="/cases/new" className="btn btn-primary btn-sm">
                <PlusCircle size={14} />
                <span>Create Dispute Dossier</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table table-clickable">
              <thead>
                <tr>
                  <th>Dossier Ref</th>
                  <th>Merchant Legal Entity</th>
                  <th>Classification</th>
                  <th
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (sortField === 'requested_amount') setSortAsc(!sortAsc);
                      else {
                        setSortField('requested_amount');
                        setSortAsc(false);
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>Disputed Amount</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th>Status</th>
                  <th
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (sortField === 'created_at') setSortAsc(!sortAsc);
                      else {
                        setSortField('created_at');
                        setSortAsc(false);
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>Filed Date</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} onClick={() => router.push(`/cases/${c.id}`)}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>
                      {c.case_number}
                    </td>
                    <td style={{ fontWeight: 600 }}>{c.merchant_name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {DISPUTE_LABELS[c.dispute_type] || c.dispute_type}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {c.requested_amount
                        ? `₹${c.requested_amount.toLocaleString('en-IN')}`
                        : '—'}
                    </td>
                    <td>
                      <span className={`badge badge-${c.status}`}>{c.status}</span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Link
                          href={`/cases/${c.id}`}
                          className="btn btn-secondary btn-sm"
                          onClick={(e) => e.stopPropagation()}
                          title="Open Case Workspace"
                          style={{ padding: '4px 8px' }}
                        >
                          <ExternalLink size={13} />
                        </Link>
                        <Link
                          href={`/negotiations?case_id=${c.id}`}
                          className="btn btn-primary btn-sm"
                          onClick={(e) => e.stopPropagation()}
                          title="Launch AI Negotiation Console"
                          style={{ padding: '4px 8px' }}
                        >
                          <Bot size={13} />
                        </Link>
                      </div>
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

export default function CasesListPage() {
  return (
    <Suspense fallback={<div className="page-content">Loading dossiers registry...</div>}>
      <CasesListContent />
    </Suspense>
  );
}
