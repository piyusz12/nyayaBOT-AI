'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { useAuth } from '@/lib/auth-context';
import {
  listCases,
  startNegotiationSession,
  subscribeSessionStream,
  submitHitlDecision,
  triggerKillswitch,
  executeBotTurn,
  type CaseSummary,
  type NegotiationMessage,
  type AgentNodeEvent,
  type HitlPendingData,
  type BotTurnResponse,
} from '@/lib/api';
import {
  Bot,
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Clock,
  ShieldAlert,
  Scale,
  Activity,
  Layers,
  Send,
  UserCheck,
  ChevronRight,
  Flame,
  Sparkles,
  Copy,
  Cpu,
  Zap,
} from 'lucide-react';

interface AgentNodeState {
  id: string;
  name: string;
  title: string;
  status: 'PENDING' | 'EXECUTING' | 'PASSED' | 'BLOCKED' | 'AWAITING_HITL' | 'ESCALATED';
  description: string;
  details?: Record<string, any>;
  timestamp?: string;
}

const INITIAL_NODES: AgentNodeState[] = [
  {
    id: 'triage_loop_detector',
    name: 'Triage & Loop Detection',
    title: '1. Triage & Deflection Detector',
    status: 'PENDING',
    description: 'Calculates cosine similarity S_max(t) against prior bot turns to identify stalling loops.',
  },
  {
    id: 'legal_retriever',
    name: 'Legal Retrieval & Strategy',
    title: '2. Statutory Grounding',
    status: 'PENDING',
    description: 'Retrieves applicable clauses from CCPA 2023 Guidelines and CPA 2019 provisions.',
  },
  {
    id: 'dialogue_generator',
    name: 'Dialogue Generation',
    title: '3. Assertive Dialogue Generator',
    status: 'PENDING',
    description: 'Synthesizes formal counter-arguments asserting refund rights with statutory deadlines.',
  },
  {
    id: 'sentinel_audit',
    name: 'Sentinel Audit',
    title: '4. Sentinel Safety Audit',
    status: 'PENDING',
    description: 'Verifies zero hallucinated legislation, factual grounding, and exact disputed amount.',
  },
  {
    id: 'human_approval_gate',
    name: 'Human Approval Gate',
    title: '5. HITL Settlement Gate',
    status: 'PENDING',
    description: 'Intercepts financial settlement offers and requires explicit operator sign-off.',
  },
  {
    id: 'escalation_override',
    name: 'Escalation Override',
    title: '6. Escalation Override Channel',
    status: 'PENDING',
    description: 'Activates external GRO, NCH, or Banking grievance packets on loop exhaustion.',
  },
];

export default function LiveNegotiationConsole() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // Case & Session Selection
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Live Telemetry
  const [sessionStatus, setSessionStatus] = useState<string>('IDLE');
  const [messages, setMessages] = useState<NegotiationMessage[]>([]);
  const [nodes, setNodes] = useState<AgentNodeState[]>(INITIAL_NODES);
  const [sMax, setSMax] = useState<number>(0.12);
  const [stalledTurns, setStalledTurns] = useState<number>(0);
  const [turnCount, setTurnCount] = useState<number>(1);
  const [detectedDarkPatterns, setDetectedDarkPatterns] = useState<string[]>([
    'Annexure I(5): Subscription Trap',
  ]);
  const [activeStatutes, setActiveStatutes] = useState<string[]>([
    'Consumer Protection Act 2019 Sec 2(47)',
    'CCPA Dark Pattern Guidelines 2023 Annexure I(5)',
    'RBI E-Mandate Framework 2019',
  ]);

  // HITL State
  const [pendingHitl, setPendingHitl] = useState<HitlPendingData | null>(null);
  const [hitlNotes, setHitlNotes] = useState('');
  const [isSubmittingHitl, setIsSubmittingHitl] = useState(false);

  // Connection
  const [isConnected, setIsConnected] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Local AI Playground state
  const [playgroundModel, setPlaygroundModel] = useState<string>('llama3.2:latest');
  const [customMerchantInput, setCustomMerchantInput] = useState<string>(
    'Our strict company policy states that all subscription payments are non-refundable once billed.'
  );
  const [isGeneratingTurn, setIsGeneratingTurn] = useState<boolean>(false);
  const [turnElapsedSec, setTurnElapsedSec] = useState<number>(0);
  const [turnError, setTurnError] = useState<string | null>(null);
  const [botTurnResult, setBotTurnResult] = useState<BotTurnResponse | null>(null);
  const [copiedResponse, setCopiedResponse] = useState<boolean>(false);

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const cleanupStreamRef = useRef<(() => void) | null>(null);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load available cases
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (isAuthenticated) {
      listCases().then((list) => {
        setCases(list);
        if (list.length > 0 && !selectedCaseId) {
          setSelectedCaseId(list[0].id);
        }
      });
    }
  }, [isAuthenticated, authLoading, router, selectedCaseId]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (cleanupStreamRef.current) {
        cleanupStreamRef.current();
      }
    };
  }, []);

  const selectedCase = cases.find((c) => c.id === selectedCaseId);

  // Start live session
  const handleStartSession = async () => {
    if (!selectedCaseId) return;
    setIsStarting(true);
    setErrorMessage(null);
    setMessages([]);
    setNodes(INITIAL_NODES);
    setPendingHitl(null);

    try {
      const resp = await startNegotiationSession(selectedCaseId);
      setSessionId(resp.session_id);
      setSessionStatus(resp.status);

      // Connect to SSE stream
      connectStream(resp.session_id);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to start negotiation session');
    } finally {
      setIsStarting(false);
    }
  };

  const connectStream = useCallback((sessId: string) => {
    if (cleanupStreamRef.current) {
      cleanupStreamRef.current();
    }

    const unsub = subscribeSessionStream(sessId, {
      onConnected: (data) => {
        setIsConnected(true);
        setSessionStatus(data.status || 'NEGOTIATING');
      },
      onNodeTransition: (nodeEvent: AgentNodeEvent) => {
        setNodes((prev) =>
          prev.map((n) => {
            if (n.id === nodeEvent.node) {
              return {
                ...n,
                status: nodeEvent.status as any,
                description: nodeEvent.description || n.description,
                timestamp: nodeEvent.timestamp,
              };
            }
            if (n.status === 'EXECUTING') {
              return { ...n, status: 'PASSED' };
            }
            return n;
          })
        );

        if (nodeEvent.s_max !== undefined) setSMax(nodeEvent.s_max);
        if (nodeEvent.stalled_turns !== undefined) setStalledTurns(nodeEvent.stalled_turns);
        if (nodeEvent.retrieved_statutes) setActiveStatutes(nodeEvent.retrieved_statutes);
        if (nodeEvent.detected_dark_pattern) {
          setDetectedDarkPatterns((prev) => Array.from(new Set([...prev, nodeEvent.detected_dark_pattern!])));
        }
      },
      onMessage: (msg: NegotiationMessage) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTurnCount((prev) => prev + 1);
      },
      onHitlRequired: (hitlData: HitlPendingData) => {
        setPendingHitl(hitlData);
        setSessionStatus('AWAITING_HITL');
        setNodes((prev) =>
          prev.map((n) =>
            n.id === 'human_approval_gate'
              ? { ...n, status: 'AWAITING_HITL', description: hitlData.prompt }
              : n
          )
        );
      },
      onResolved: (data) => {
        setSessionStatus('RESOLVED');
        setPendingHitl(null);
        setNodes((prev) =>
          prev.map((n) => ({ ...n, status: n.id === 'human_approval_gate' ? 'PASSED' : n.status }))
        );
      },
      onEscalated: (data) => {
        setSessionStatus('ESCALATE_EXTERNAL');
        setPendingHitl(null);
        setNodes((prev) =>
          prev.map((n) =>
            n.id === 'escalation_override' ? { ...n, status: 'ESCALATED' } : n
          )
        );
      },
      onError: (err) => {
        setIsConnected(false);
      },
    });

    cleanupStreamRef.current = unsub;
  }, []);

  // Handle HITL Decision
  const handleHitlDecision = async (decision: 'approved' | 'rejected') => {
    if (!sessionId) return;
    setIsSubmittingHitl(true);
    try {
      await submitHitlDecision(sessionId, decision, hitlNotes || undefined);
      setPendingHitl(null);
      setSessionStatus(decision === 'approved' ? 'RESOLVED' : 'ESCALATE_EXTERNAL');
    } catch (err: any) {
      alert(err.message || 'Failed to submit HITL decision');
    } finally {
      setIsSubmittingHitl(false);
    }
  };

  // Trigger Killswitch (Emergency override)
  const handleKillswitch = async () => {
    if (!sessionId) return;
    const confirmStop = confirm(
      'Are you sure you want to trigger the Killswitch?\n\nThis immediately halts autonomous negotiation and files a formal escalation with the Grievance Redressal Officer (GRO).'
    );
    if (!confirmStop) return;

    try {
      await triggerKillswitch(sessionId, 'Operator invoked manual escalation killswitch', 'grievance_officer');
      setSessionStatus('ESCALATE_EXTERNAL');
      setPendingHitl(null);
      setNodes((prev) =>
        prev.map((n) =>
          n.id === 'escalation_override'
            ? { ...n, status: 'ESCALATED', description: 'Emergency killswitch invoked by operator.' }
            : n
        )
      );
    } catch (err: any) {
      alert(err.message || 'Failed to invoke killswitch');
    }
  };

  // Generate bot turn with local AI
  const handleGenerateBotTurn = async (presetText?: string) => {
    const defaultMsg = 'Our strict company policy states that all subscription payments are non-refundable once billed.';
    const inputMsg = (presetText !== undefined ? presetText : customMerchantInput).trim() || defaultMsg;
    setCustomMerchantInput(inputMsg);
    setIsGeneratingTurn(true);
    setTurnError(null);
    setCopiedResponse(false);
    setTurnElapsedSec(0);

    const timer = setInterval(() => {
      setTurnElapsedSec((prev) => +(prev + 0.5).toFixed(1));
    }, 500);

    try {
      const res = await executeBotTurn({
        merchant_message: inputMsg,
        merchant_name: selectedCase?.merchant_name || 'Merchant',
        requested_amount_inr: selectedCase?.requested_amount || 2499.0,
        model: playgroundModel,
      });
      setBotTurnResult(res);
    } catch (err: any) {
      setTurnError(err.message || 'Failed to generate bot turn. Ensure Ollama is running on port 11434.');
    } finally {
      clearInterval(timer);
      setIsGeneratingTurn(false);
    }
  };

  // Inject generated response into the active transcript
  const handleInjectIntoTranscript = () => {
    if (!botTurnResult) return;
    const merchantMsgText = customMerchantInput.trim() || 'Merchant statement received';
    const newMerchantMsg: NegotiationMessage = {
      id: `merchant-${Date.now()}`,
      sender: 'merchant',
      sender_label: `${selectedCase?.merchant_name || 'Merchant'} Support Bot`,
      content: merchantMsgText,
      timestamp: new Date().toISOString(),
    };
    const newAgentMsg: NegotiationMessage = {
      id: `agent-${Date.now()}`,
      sender: 'agent',
      sender_label: botTurnResult.fallback_used
        ? 'NyayaBot (Statutory Engine)'
        : `NyayaBot AI (${botTurnResult.model_used})`,
      content: botTurnResult.response_text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newMerchantMsg, newAgentMsg]);
    setTurnCount((prev) => prev + 1);
    if (botTurnResult.detected_dark_patterns?.length) {
      setDetectedDarkPatterns((prev) => Array.from(new Set([...prev, ...botTurnResult.detected_dark_patterns])));
    }
    if (botTurnResult.statutory_citations?.length) {
      setActiveStatutes((prev) => Array.from(new Set([...prev, ...botTurnResult.statutory_citations])));
    }
  };

  return (
    <>
      <Header title="Live AI Negotiation Console" />
      <div className="page-content" style={{ paddingBottom: 'var(--space-4)' }}>
        {/* Top Console Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-4)',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          {/* Dossier Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Active Dossier:
            </label>
            <select
              className="form-select"
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              disabled={sessionStatus === 'NEGOTIATING' || sessionStatus === 'AWAITING_HITL'}
              style={{ width: 280, padding: '7px 12px', fontSize: 13 }}
            >
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.case_number} — {c.merchant_name} (₹{c.requested_amount?.toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          {/* Session Status & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              className={`badge badge-${
                sessionStatus === 'NEGOTIATING'
                  ? 'active'
                  : sessionStatus === 'AWAITING_HITL'
                  ? 'review'
                  : sessionStatus === 'RESOLVED'
                  ? 'resolved'
                  : sessionStatus === 'ESCALATE_EXTERNAL'
                  ? 'escalated'
                  : 'draft'
              }`}
            >
              ● {sessionStatus}
            </span>

            {/* Local AI Engine Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(20, 184, 166, 0.12)',
                border: '1px solid rgba(20, 184, 166, 0.3)',
                fontSize: 12,
                color: 'var(--teal)',
                fontWeight: 600,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--teal)', display: 'inline-block' }} />
              <Cpu size={13} />
              <span>Local AI Engine: Llama 3.2 (Offline & Private)</span>
            </div>

            {/* Start / Restart */}
            <button
              className="btn btn-primary btn-sm"
              onClick={handleStartSession}
              disabled={isStarting || !selectedCaseId}
            >
              <Play size={14} />
              <span>{sessionId ? 'Restart Session' : 'Start Session'}</span>
            </button>

            {/* Killswitch Override */}
            {(sessionStatus === 'NEGOTIATING' || sessionStatus === 'AWAITING_HITL') && (
              <button
                className="btn btn-danger btn-sm"
                onClick={handleKillswitch}
                title="Halt negotiation and escalate to GRO"
              >
                <Flame size={14} />
                <span>Killswitch Override</span>
              </button>
            )}
          </div>
        </div>

        {errorMessage && (
          <div
            style={{
              padding: '10px 14px',
              background: 'var(--error-bg)',
              border: '1px solid var(--error-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--error)',
              fontSize: 13,
              marginBottom: 'var(--space-3)',
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* ── FLAGSHIP THREE-PANEL CONSOLE ──────────────────────────── */}
        <div className="negotiation-console">
          {/* ── PANEL 1: Left Case Context ──────────────────────────── */}
          <div className="console-panel">
            <div className="console-panel-header">
              <span className="console-panel-title">
                <Layers size={15} /> Case Context
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                {selectedCase?.case_number}
              </span>
            </div>

            <div className="console-panel-body">
              {selectedCase ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Merchant Legal Name
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                      {selectedCase.merchant_name}
                    </div>
                    {selectedCase.merchant_website && (
                      <div style={{ fontSize: 12, color: 'var(--brand-primary-light)' }}>
                        {selectedCase.merchant_website}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      background: 'var(--bg-surface-raised)',
                      padding: 12,
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Disputed Claim
                    </div>
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 800,
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      ₹{selectedCase.requested_amount?.toLocaleString('en-IN') || '0'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Currency: {selectedCase.currency} · Floor: ₹{(selectedCase.requested_amount ? selectedCase.requested_amount * 0.8 : 0).toLocaleString()}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                      Active Statutes Grounded
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {activeStatutes.map((st, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: 11.5,
                            padding: '4px 8px',
                            background: 'rgba(14, 165, 233, 0.08)',
                            border: '1px solid rgba(14, 165, 233, 0.2)',
                            borderRadius: 4,
                            color: 'var(--brand-primary-light)',
                          }}
                        >
                          ⚖️ {st}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                      Detected Dark Patterns
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {detectedDarkPatterns.map((dp, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: 11.5,
                            padding: '4px 8px',
                            background: 'var(--warning-bg)',
                            border: '1px solid var(--warning-border)',
                            borderRadius: 4,
                            color: 'var(--warning)',
                          }}
                        >
                          ⚠️ {dp}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Resolution Constraints
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                      • Store credit: {selectedCase.accept_store_credit ? 'Acceptable' : 'Refused (Cash only)'}
                      <br />
                      • Mandate revocation required: Yes
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
                  Select a dispute dossier to load context
                </div>
              )}
            </div>
          </div>

          {/* ── PANEL 2: Center Live Negotiation Transcript ──────────── */}
          <div className="console-panel" style={{ flex: 1 }}>
            <div className="console-panel-header">
              <span className="console-panel-title">
                <Bot size={15} /> Real-Time Negotiation Transcript
              </span>
              <span style={{ fontSize: 12, color: isConnected ? 'var(--success)' : 'var(--text-muted)' }}>
                {isConnected ? '● Stream Live' : '○ Standby'}
              </span>
            </div>

            <div className="console-panel-body">
              {/* HITL Approval Gate Notice if Pending */}
              {pendingHitl && (
                <div className="hitl-banner">
                  <div className="hitl-banner-header">
                    <UserCheck size={20} color="var(--warning)" />
                    <span className="hitl-banner-title">
                      Settlement Concession Intercepted — Human Authorization Required
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Merchant has submitted a settlement offer. Under PS 30 HITL governance, autonomous actions
                    are paused until you approve or reject.
                  </p>

                  <div className="hitl-metrics-row">
                    <div className="hitl-metric-item">
                      <div className="hitl-metric-label">Merchant Offer</div>
                      <div className="hitl-metric-val" style={{ color: 'var(--success)' }}>
                        ₹{pendingHitl.offer_amount_inr.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="hitl-metric-item">
                      <div className="hitl-metric-label">Disputed Claim</div>
                      <div className="hitl-metric-val">
                        ₹{pendingHitl.requested_amount_inr.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="hitl-metric-item">
                      <div className="hitl-metric-label">Difference / Haircut</div>
                      <div className="hitl-metric-val" style={{ color: 'var(--warning)' }}>
                        -₹{pendingHitl.difference_inr.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Optional decision notes or condition for merchant..."
                      value={hitlNotes}
                      onChange={(e) => setHitlNotes(e.target.value)}
                      style={{ fontSize: 13 }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleHitlDecision('approved')}
                      disabled={isSubmittingHitl}
                    >
                      <CheckCircle size={14} />
                      <span>Accept Settlement Offer (₹{pendingHitl.offer_amount_inr.toLocaleString()})</span>
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleHitlDecision('rejected')}
                      disabled={isSubmittingHitl}
                    >
                      <AlertTriangle size={14} />
                      <span>Reject & Escalate to GRO / NCH</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Messages feed */}
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                  <Bot size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Negotiation Session Ready
                  </div>
                  <div style={{ fontSize: 13, maxWidth: 360, margin: '0 auto' }}>
                    Click &quot;Start Session&quot; to initialize multi-agent dialogue, loop detection, and statutory counter-assertions.
                  </div>
                </div>
              ) : (
                <div className="transcript-feed">
                  {messages.map((m) => (
                    <div key={m.id} className={`transcript-message ${m.sender}`}>
                      <div className="transcript-sender">
                        <span>{m.sender_label}</span>
                        <span className="transcript-time">
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <div className="transcript-text">{m.content}</div>
                    </div>
                  ))}
                  <div ref={transcriptEndRef} />
                </div>
              )}
            </div>
          </div>

          {/* ── PANEL 3: Right Agent Execution Monitor ──────────────── */}
          <div className="console-panel">
            <div className="console-panel-header">
              <span className="console-panel-title">
                <Activity size={15} /> Execution Monitor
              </span>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                Turn {turnCount}
              </span>
            </div>

            <div className="console-panel-body">
              {/* Telemetry Metrics */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                  marginBottom: 16,
                  background: 'var(--bg-surface-raised)',
                  padding: 10,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Loop Similarity S_max
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      color: sMax >= 0.88 ? 'var(--error)' : 'var(--text-primary)',
                    }}
                  >
                    {sMax.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Stalled Turns
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      color: stalledTurns > 0 ? 'var(--warning)' : 'var(--text-primary)',
                    }}
                  >
                    {stalledTurns} / 3
                  </div>
                </div>
              </div>

              {/* 6 Agent Nodes Visual Graph */}
              <div className="agent-node-graph">
                {nodes.map((node) => {
                  const isNodeActive = node.status === 'EXECUTING';
                  const isNodePassed = node.status === 'PASSED';
                  const isNodeHitl = node.status === 'AWAITING_HITL';
                  const isNodeEscalated = node.status === 'ESCALATED';

                  return (
                    <div
                      key={node.id}
                      className={`agent-node-card ${
                        isNodeActive ? 'active' : isNodePassed ? 'passed' : ''
                      }`}
                    >
                      <div className="agent-node-header">
                        <span className="agent-node-title">
                          {node.title}
                        </span>
                        <span
                          className={`agent-node-status ${
                            isNodeActive
                              ? 'executing'
                              : isNodePassed
                              ? 'passed'
                              : isNodeHitl
                              ? 'executing'
                              : isNodeEscalated
                              ? 'executing'
                              : 'pending'
                          }`}
                        >
                          {node.status}
                        </span>
                      </div>
                      <p className="agent-node-desc">{node.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── NyayaBot Local AI Playground ── */}
        <div
          className="card"
          style={{
            marginTop: 'var(--space-4)',
            background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.05) 0%, rgba(10, 28, 62, 0.4) 100%)',
            border: '1px solid rgba(20, 184, 166, 0.25)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: 12,
              marginBottom: 16,
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'rgba(20, 184, 166, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--teal)',
                }}
              >
                <Sparkles size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  NyayaBot Local AI Playground & Live Counter-Agent
                </h3>
                <p style={{ fontSize: 12, margin: 0, color: 'var(--text-muted)' }}>
                  Test corporate chatbot deflection patterns with local Ollama models (offline, zero-cloud, 100% private)
                </p>
              </div>
            </div>

            {/* Model Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                Active Model:
              </span>
              <select
                className="form-select"
                value={playgroundModel}
                onChange={(e) => setPlaygroundModel(e.target.value)}
                style={{ width: 280, fontSize: 12, padding: '6px 10px' }}
              >
                <option value="llama3.2:latest">⚡ Llama 3.2 3B (Fastest & Warm in VRAM — Recommended)</option>
                <option value="llama3.1:latest">Llama 3.1 8B (Deep Grounding — ~40s cold load)</option>
                <option value="deepseek-r1:8b">DeepSeek-R1 8B (Reasoning — ~45s cold load)</option>
                <option value="qwen2.5-coder:7b">Qwen 2.5 Coder 7B (40s cold load)</option>
              </select>
            </div>
          </div>

          {/* Quick presets */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
              Quick Scenario Presets:
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ fontSize: 12 }}
                onClick={() => {
                  const text = 'Our strict company policy states that all subscription payments are non-refundable once billed.';
                  setCustomMerchantInput(text);
                  handleGenerateBotTurn(text);
                }}
              >
                1. Non-Refundable Policy Refusal
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ fontSize: 12 }}
                onClick={() => {
                  const text = 'You cannot cancel online. Per our terms, you must call our telephone customer care helpline between 10am-4pm.';
                  setCustomMerchantInput(text);
                  handleGenerateBotTurn(text);
                }}
              >
                2. Forced Phone Call Trap
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ fontSize: 12 }}
                onClick={() => {
                  const text = 'We cannot process bank refunds, but we can offer you 200 reward wallet points or a ₹300 voucher.';
                  setCustomMerchantInput(text);
                  handleGenerateBotTurn(text);
                }}
              >
                3. Forced Credit / Coupon
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ fontSize: 12 }}
                onClick={() => {
                  const text = 'The dispute window of 48 hours has expired. No further compensation can be provided.';
                  setCustomMerchantInput(text);
                  handleGenerateBotTurn(text);
                }}
              >
                4. Arbitrary Time Limit Window
              </button>
            </div>
          </div>

          {/* Error Banner if any */}
          {turnError && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                fontSize: 13,
                marginBottom: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={15} />
                <span>{turnError}</span>
              </div>
              <button
                type="button"
                onClick={() => setTurnError(null)}
                style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 13 }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Custom Input */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Or type/paste any real merchant chatbot deflection message here..."
              value={customMerchantInput}
              onChange={(e) => setCustomMerchantInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleGenerateBotTurn();
                }
              }}
              style={{ flex: 1, fontSize: 13 }}
            />
            <button
              className="btn btn-primary"
              onClick={() => handleGenerateBotTurn()}
              disabled={isGeneratingTurn}
              style={{ minWidth: 180 }}
            >
              {isGeneratingTurn ? (
                <>
                  <Zap size={14} className="animate-spin" />
                  <span>Thinking ({turnElapsedSec}s)...</span>
                </>
              ) : (
                <>
                  <Zap size={14} />
                  <span>Generate Counter</span>
                </>
              )}
            </button>
          </div>

          {/* Response Display */}
          {botTurnResult && (
            <div
              style={{
                background: 'var(--bg-surface-raised)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {botTurnResult.fallback_used ? (
                    <span
                      className="badge"
                      style={{
                        fontSize: 11,
                        background: 'rgba(234, 179, 8, 0.15)',
                        color: '#facc15',
                        border: '1px solid rgba(234, 179, 8, 0.3)',
                        fontWeight: 600,
                      }}
                    >
                      ⚠️ Statutory Rule Fallback
                    </span>
                  ) : (
                    <span className="badge badge-active" style={{ fontSize: 11, fontWeight: 600 }}>
                      ⚡ {botTurnResult.model_used}
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Generated in {botTurnResult.latency_ms}ms ({botTurnResult.fallback_used ? 'Deterministic Rules Engine' : 'Offline Local AI'})
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: 12 }}
                    onClick={() => {
                      navigator.clipboard.writeText(botTurnResult.response_text);
                      setCopiedResponse(true);
                      setTimeout(() => setCopiedResponse(false), 2000);
                    }}
                  >
                    <Copy size={12} />
                    <span>{copiedResponse ? 'Copied!' : 'Copy Rebuttal'}</span>
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ fontSize: 12 }}
                    onClick={handleInjectIntoTranscript}
                  >
                    <Play size={12} />
                    <span>Add to Live Transcript</span>
                  </button>
                </div>
              </div>

              {/* Counter text */}
              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: 'var(--text-primary)',
                  fontWeight: 500,
                  padding: '10px 14px',
                  background: 'rgba(20, 184, 166, 0.08)',
                  borderRadius: 6,
                  borderLeft: '3px solid var(--teal)',
                  marginBottom: 12,
                }}
              >
                {botTurnResult.response_text}
              </div>

              {/* Detected violations and statutes */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12 }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Detected Violations: </span>
                  {botTurnResult.detected_dark_patterns.map((p, idx) => (
                    <span key={idx} className="badge badge-escalated" style={{ marginLeft: 6, fontSize: 11 }}>
                      {p}
                    </span>
                  ))}
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Statutory Basis: </span>
                  {botTurnResult.statutory_citations.map((s, idx) => (
                    <span key={idx} className="badge badge-review" style={{ marginLeft: 6, fontSize: 11 }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

