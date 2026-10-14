'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { href: '/', icon: '📊', label: 'Dashboard' },
      { href: '/cases', icon: '📁', label: 'All Cases' },
    ],
  },
  {
    label: 'Actions',
    items: [
      { href: '/cases/new', icon: '➕', label: 'New Dispute' },
      { href: '/approvals', icon: '✅', label: 'Approvals', badge: 0 },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/escalations', icon: '🚨', label: 'Escalations' },
      { href: '/audit', icon: '📋', label: 'Audit Log' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">G</div>
        <div>
          <div className="sidebar-brand-text">Garuda AI</div>
          <div className="sidebar-brand-version">PS 30 · v0.1.0</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="sidebar-section-label">{section.label}</div>
            {section.items.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="nav-badge">{item.badge}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{
        padding: 'var(--space-4) var(--space-6)',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: '11px',
        color: 'var(--text-muted)',
      }}>
        Consumer Dispute Platform
      </div>
    </aside>
  );
}
