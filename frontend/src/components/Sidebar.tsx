'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderKanban,
  Bot,
  ShieldCheck,
  Scale,
  AlertTriangle,
  FileText,
  History,
  Settings,
  PlusCircle,
  CheckSquare,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  activeColor?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Command & Dossiers',
    items: [
      { href: '/', label: 'Overview', icon: LayoutDashboard },
      { href: '/cases', label: 'Dispute Dossiers', icon: FolderKanban },
      { href: '/cases/new', label: 'New Dossier Intake', icon: PlusCircle },
    ],
  },
  {
    label: 'Autonomous Ops',
    items: [
      { href: '/negotiations', label: 'Live Negotiations', icon: Bot },
      { href: '/approvals', label: 'Approval Center', icon: CheckSquare },
      { href: '/evidence', label: 'Evidence Vault', icon: ShieldCheck },
    ],
  },
  {
    label: 'Statutory & Escalation',
    items: [
      { href: '/legal-research', label: 'Legal Research', icon: Scale },
      { href: '/escalations', label: 'Escalations', icon: AlertTriangle },
      { href: '/documents', label: 'Document Generator', icon: FileText },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { href: '/audit', label: 'Audit Trail', icon: History },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <Link
        href="/"
        className="sidebar-brand"
        style={{
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 14px',
          borderRadius: '10px',
          transition: 'all 0.2s ease',
        }}
      >
        <img
          src="/nyayabot-icon-dark.png"
          alt="NyayaBot"
          style={{
            width: 38,
            height: 38,
            objectFit: 'contain',
            borderRadius: '8px',
            filter: 'drop-shadow(0 0 10px rgba(20, 184, 166, 0.4))',
          }}
        />
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: '#F8FAFC' }}>
              Nyaya
            </span>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: '#14B8A6' }}>
              Bot
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: '1px 5px',
                marginLeft: 5,
                borderRadius: 4,
                background: 'rgba(20, 184, 166, 0.15)',
                color: '#2DD4BF',
                border: '1px solid rgba(20, 184, 166, 0.35)',
              }}
            >
              AI
            </span>
          </div>
          <div className="sidebar-brand-version" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Consumer Legal Counter-Agent
          </div>
        </div>
      </Link>

      {/* Navigation Sections */}
      <nav className="sidebar-nav">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="sidebar-section-label">{section.label}</div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href) && item.href !== '/cases/new');

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="nav-badge active-badge">{item.badge}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer Info */}
      <div className="sidebar-footer">
        <span>Grounded on CPA 2019 & CCPA</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>v1.2.0</span>
      </div>
    </aside>
  );
}
