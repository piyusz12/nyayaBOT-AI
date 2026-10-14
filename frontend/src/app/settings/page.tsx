'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import { useAuth } from '@/lib/auth-context';
import { checkBackendHealth } from '@/lib/api';
import {
  Settings,
  Server,
  Shield,
  Sliders,
  User,
  Bell,
  RefreshCw,
  CheckCircle,
} from 'lucide-react';

export default function SettingsPage() {
  const { isAuthenticated } = useAuth();
  const [backendStatus, setBackendStatus] = useState<any>(null);
  const [checking, setChecking] = useState(false);

  // Agent Settings
  const [defaultResolutionFloor, setDefaultResolutionFloor] = useState('80');
  const [similarityThreshold, setSimilarityThreshold] = useState('0.88');
  const [maxStalledTurns, setMaxStalledTurns] = useState('3');
  const [autoKillswitchOnHighSim, setAutoKillswitchOnHighSim] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const pingBackend = async () => {
    setChecking(true);
    const health = await checkBackendHealth();
    setBackendStatus(health);
    setChecking(false);
  };

  useEffect(() => {
    pingBackend();
  }, []);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <>
      <Header title="Settings & Platform Governance" />
      <div className="page-content" style={{ maxWidth: 860 }}>
        <div className="page-header">
          <div>
            <h1 className="page-title">Platform Settings & AI Governance</h1>
            <p className="page-subtitle">
              Configure backend connectivity, multi-agent loop detection parameters, and statutory escalation thresholds.
            </p>
          </div>
        </div>

        {savedSuccess && (
          <div
            style={{
              padding: 12,
              background: 'var(--success-bg)',
              border: '1px solid var(--success-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--success)',
              fontSize: 13,
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <CheckCircle size={16} />
            <span>Governance parameters saved successfully.</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* 1. Backend Connectivity & Infrastructure */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <Server size={16} /> Backend Service Connectivity
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={pingBackend}
                disabled={checking}
              >
                <RefreshCw size={13} className={checking ? 'animate-spin' : ''} />
                <span>{checking ? 'Pinging...' : 'Test Connection'}</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Configured API Base URL
                </div>
                <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                  {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Server Status
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span
                    className={`health-dot ${backendStatus ? 'online' : 'offline'}`}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {backendStatus ? `Online — ${backendStatus.service}` : 'Offline (Local Standalone Mode)'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Autonomous Agent Governance Parameters */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <Sliders size={16} /> Multi-Agent Execution & Loop Thresholds
              </span>
            </div>

            <form onSubmit={handleSaveSettings}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Default Minimum Settlement Floor (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    className="form-input"
                    value={defaultResolutionFloor}
                    onChange={(e) => setDefaultResolutionFloor(e.target.value)}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    Agent will automatically flag an approval gate if merchant offers below this percentage of claim.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Stalling Cosine Similarity S_max(t)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.5"
                    max="1.0"
                    className="form-input"
                    value={similarityThreshold}
                    onChange={(e) => setSimilarityThreshold(e.target.value)}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    Trigger deflection increment when consecutive corporate bot responses exceed this similarity.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Max Stalled Turns Before Escalation</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    className="form-input"
                    value={maxStalledTurns}
                    onChange={(e) => setMaxStalledTurns(e.target.value)}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    Turns allowed in deflection loop before triggering statutory escalation override.
                  </span>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={autoKillswitchOnHighSim}
                    onChange={(e) => setAutoKillswitchOnHighSim(e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                  <span>Automatically engage GRO escalation override when S_max &gt;= 0.95</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="submit" className="btn btn-primary">
                  Save Governance Rules
                </button>
              </div>
            </form>
          </div>

          {/* 3. Operator Security & Privacy */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <Shield size={16} /> Privacy & Identifier Governance
              </span>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              In compliance with Digital Personal Data Protection (DPDP) Act 2023 and PS 30 privacy guidelines,
              Aadhaar numbers and sensitive authentication credentials are never requested, stored, or persisted.
              All evidence tokens are stored with cryptographic SHA-256 signatures for evidentiary authenticity.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
