'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import { searchLegalProvisions, type LegalProvision } from '@/lib/api';
import {
  Scale,
  Search,
  AlertTriangle,
  BookOpen,
  Filter,
  ShieldAlert,
  ExternalLink,
} from 'lucide-react';

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'Unfair Trade Practice', label: 'Unfair Trade Practice (CPA)' },
  { value: 'Subscription Trap', label: 'Subscription Trap (CCPA)' },
  { value: 'Interface Interference', label: 'Interface Interference' },
  { value: 'Drip Pricing', label: 'Drip Pricing' },
  { value: 'E-Mandate Compliance', label: 'E-Mandate Compliance (RBI)' },
  { value: 'Grievance Redressal', label: 'Grievance Redressal (E-Commerce)' },
];

const SEVERITIES = [
  { value: 'all', label: 'All Severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
];

export default function LegalResearchPage() {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [results, setResults] = useState<LegalProvision[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProvisions = async () => {
    setLoading(true);
    try {
      const resp = await searchLegalProvisions(
        query.trim() || undefined,
        selectedCategory !== 'all' ? selectedCategory : undefined,
        selectedSeverity !== 'all' ? selectedSeverity : undefined
      );
      setResults(resp.results);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProvisions();
  }, [selectedCategory, selectedSeverity]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProvisions();
  };

  return (
    <>
      <Header title="Legal Research & Dark-Pattern Index" />
      <div className="page-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Statutory Knowledge & Dark-Pattern Analysis</h1>
            <p className="page-subtitle">
              Searchable legal index of grounded Indian consumer protection statutes, CCPA 2023 Dark Pattern
              prohibitions, and RBI e-mandate regulatory frameworks.
            </p>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <form onSubmit={handleSearchSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Keyword / Statutory Search</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search section, dark pattern, e-mandate, or regulation..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    style={{ paddingLeft: 34 }}
                  />
                  <Search size={15} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-muted)' }} />
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Category</label>
                <select
                  className="form-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Severity Level</label>
                <select
                  className="form-select"
                  value={selectedSeverity}
                  onChange={(e) => setSelectedSeverity(e.target.value)}
                >
                  {SEVERITIES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" className="btn btn-primary" style={{ height: 42 }}>
                Search Provisions
              </button>
            </div>
          </form>
        </div>

        {/* Results Count */}
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Displaying {results.length} verified statutory provisions and CCPA guidelines
        </div>

        {/* Cards Grid */}
        {loading ? (
          <div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 140, marginBottom: 16 }} />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">
                <Scale size={24} />
              </div>
              <div className="empty-state-title">No Matching Provisions Found</div>
              <div className="empty-state-desc">
                Try broadening your search term or clearing the category and severity filters.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 16 }}>
            {results.map((item) => (
              <div key={item.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {item.source_name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--brand-primary-light)', fontFamily: 'var(--font-mono)' }}>
                        {item.section_or_annexure} · {item.act_or_regulation}
                      </div>
                    </div>
                    <span
                      className={`badge badge-${
                        item.severity === 'critical'
                          ? 'failed'
                          : item.severity === 'high'
                          ? 'review'
                          : 'active'
                      }`}
                    >
                      {item.severity}
                    </span>
                  </div>

                  {/* Quoted Statutory Text */}
                  <div
                    style={{
                      background: 'var(--bg-surface-raised)',
                      borderLeft: '3px solid var(--brand-primary)',
                      padding: 12,
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 12.5,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-primary)',
                      lineHeight: 1.5,
                      marginBottom: 12,
                    }}
                  >
                    &ldquo;{item.retrieved_text}&rdquo;
                  </div>

                  {/* AI Legal Explanation */}
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Practical Legal Application:</strong>{' '}
                    {item.relevance_explanation}
                  </div>
                </div>

                <div
                  style={{
                    borderTop: '1px solid var(--border-subtle)',
                    marginTop: 14,
                    paddingTop: 10,
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11.5,
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>Category: {item.category}</span>
                  {item.dark_pattern_code && (
                    <span style={{ fontFamily: 'var(--font-mono)' }}>Code: {item.dark_pattern_code}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
