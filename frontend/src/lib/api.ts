/**
 * PS 30 Counter-Agent — Central Typed API Client
 * Connects to the FastAPI backend with token auth, SSE streaming client,
 * error handling, and legal-tech data structures.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ── Token Management ─────────────────────────────────────────────────
let accessToken: string | null = null;

export function setToken(token: string) {
  accessToken = token;
  if (typeof window !== 'undefined') {
    localStorage.setItem('ps30_token', token);
  }
}

export function getToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== 'undefined') {
    accessToken = localStorage.getItem('ps30_token') || localStorage.getItem('garuda_token');
  }
  return accessToken;
}

export function clearToken() {
  accessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('ps30_token');
    localStorage.removeItem('garuda_token');
  }
}

// ── Base API Fetcher ─────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, errBody.detail || 'Request failed');
  }

  return res.json();
}

// ── Health Check ─────────────────────────────────────────────────────
export async function checkBackendHealth(): Promise<{ status: string; service: string; version: string } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/health`, { method: 'GET', cache: 'no-store' });
    if (res.ok) return await res.json();
    return null;
  } catch {
    return null;
  }
}

// ── Auth ─────────────────────────────────────────────────────────────
export async function register(email: string, password: string, fullName?: string) {
  return apiFetch<{ id: string; email: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, full_name: fullName }),
  });
}

export async function login(email: string, password: string) {
  const form = new URLSearchParams();
  form.append('username', email);
  form.append('password', password);

  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Authentication failed' }));
    throw new ApiError(res.status, err.detail);
  }

  const data = await res.json();
  setToken(data.access_token);
  return data;
}

export function logout() {
  clearToken();
}

// ── Cases & Dossiers ─────────────────────────────────────────────────
export interface CaseSummary {
  id: string;
  case_number: string;
  merchant_name: string;
  merchant_website?: string | null;
  accept_store_credit?: boolean;
  dispute_type: string;
  status: string;
  requested_amount: number | null;
  currency: string;
  created_at: string;
}

export interface CaseDetail extends CaseSummary {
  user_id: string;
  merchant_legal_entity_verified: boolean;
  merchant_website: string | null;
  jurisdiction: string;
  requested_resolution: string | null;
  accept_store_credit: boolean;
  description: string | null;
  updated_at: string;
}

export interface CaseCreateData {
  merchant_name: string;
  merchant_website?: string;
  jurisdiction?: string;
  dispute_type: string;
  requested_amount?: number;
  currency?: string;
  requested_resolution?: string;
  accept_store_credit?: boolean;
  description?: string;
}

export interface DossierV1Payload {
  merchant_name: string;
  merchant_cin?: string;
  merchant_website?: string;
  order_or_account_id?: string;
  disputed_amount_inr: number;
  currency?: string;
  transaction_timestamp?: string;
  e_mandate_ref?: string;
  cause_of_action_date?: string;
  pre_debit_notice_received?: boolean;
  dispute_type?: string;
  description?: string;
  min_acceptable_refund_inr?: number;
  accept_store_credit?: boolean;
  accept_prorated_cancellation?: boolean;
  require_emandate_revocation?: boolean;
}

export interface DossierV1Response {
  dossier_id: string;
  case_id: string;
  case_number: string;
  merchant_name: string;
  disputed_amount_inr: number;
  status: string;
  created_at: string;
}

export async function createDossierV1(payload: DossierV1Payload): Promise<DossierV1Response> {
  return apiFetch<DossierV1Response>('/api/v1/dossiers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createCase(data: CaseCreateData) {
  return apiFetch<CaseDetail>('/api/cases', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listCases(): Promise<CaseSummary[]> {
  return apiFetch<CaseSummary[]>('/api/cases');
}

export async function getCase(id: string): Promise<CaseDetail> {
  return apiFetch<CaseDetail>(`/api/cases/${id}`);
}

export async function updateCase(id: string, data: Record<string, unknown>) {
  return apiFetch<CaseDetail>(`/api/cases/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export interface DossierData {
  case_id: string;
  verified_facts: string;
  resolution_constraints: string;
  missing_fields: string;
  evidence_summary: string | null;
  created_at: string;
  updated_at: string;
}

export async function getDossier(caseId: string): Promise<DossierData> {
  return apiFetch<DossierData>(`/api/cases/${caseId}/dossier`);
}

// ── Live AI Negotiation Sessions & SSE ───────────────────────────────
export interface SessionStartResponse {
  session_id: string;
  dossier_id: string;
  case_id: string;
  status: string;
  started_at: string;
  stream_url: string;
}

export interface NegotiationMessage {
  id: string;
  sender: 'merchant' | 'agent' | 'system' | 'consumer';
  sender_label: string;
  content: string;
  timestamp: string;
}

export interface AgentNodeEvent {
  type: string;
  node: 'triage_loop_detector' | 'legal_retriever' | 'dialogue_generator' | 'sentinel_audit' | 'human_approval_gate' | 'escalation_override';
  title: string;
  status: 'EXECUTING' | 'PASSED' | 'BLOCKED' | 'AWAITING_HITL' | 'ESCALATED';
  description?: string;
  s_max?: number;
  stalled_turns?: number;
  retrieved_statutes?: string[];
  detected_dark_pattern?: string;
  proposed_response?: string;
  checks?: Record<string, string>;
  timestamp: string;
}

export interface HitlPendingData {
  session_id: string;
  status: string;
  offer_amount_inr: number;
  requested_amount_inr: number;
  difference_inr: number;
  resolution_floor_inr: number;
  merchant_name: string;
  detected_dark_patterns: string[];
  active_statutes: string[];
  prompt: string;
  timestamp: string;
}

export async function startNegotiationSession(dossierId: string): Promise<SessionStartResponse> {
  return apiFetch<SessionStartResponse>(`/api/v1/sessions/${dossierId}/start`, {
    method: 'POST',
  });
}

export async function getSessionState(sessionId: string): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(`/api/v1/sessions/${sessionId}`);
}

export async function submitHitlDecision(
  sessionId: string,
  decision: 'approved' | 'rejected',
  notes?: string,
  modifiedResolutionFloorInr?: number
): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(`/api/v1/sessions/${sessionId}/hitl`, {
    method: 'POST',
    body: JSON.stringify({
      decision,
      notes,
      modified_resolution_floor_inr: modifiedResolutionFloorInr,
    }),
  });
}

export async function triggerKillswitch(
  sessionId: string,
  reason: string = 'User invoked emergency escalation override',
  escalateTo: string = 'grievance_officer'
): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(`/api/v1/sessions/${sessionId}/killswitch`, {
    method: 'POST',
    body: JSON.stringify({
      reason,
      escalate_to: escalateTo,
    }),
  });
}

export interface SessionConnectedData {
  session_id?: string;
  status?: string;
  timestamp?: string;
  [key: string]: unknown;
}

/**
 * Robust SSE Stream Subscriber
 * Subscribes to /api/v1/sessions/{sessionId}/stream with event routing & cleanup.
 */
export function subscribeSessionStream(
  sessionId: string,
  callbacks: {
    onConnected?: (data: SessionConnectedData) => void;
    onNodeTransition?: (nodeEvent: AgentNodeEvent) => void;
    onMessage?: (msg: NegotiationMessage) => void;
    onHitlRequired?: (hitlData: HitlPendingData) => void;
    onResolved?: (data: Record<string, unknown>) => void;
    onEscalated?: (data: Record<string, unknown>) => void;
    onError?: (err: unknown) => void;
  }
): () => void {
  const url = `${API_BASE}/api/v1/sessions/${sessionId}/stream`;
  let eventSource: EventSource | null = null;

  try {
    eventSource = new EventSource(url);

    eventSource.addEventListener('connected', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        callbacks.onConnected?.(data);
      } catch (err) {
        console.error('Failed to parse SSE connected event', err);
      }
    });

    eventSource.addEventListener('node_transition', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        callbacks.onNodeTransition?.(data);
      } catch (err) {
        console.error('Failed to parse SSE node_transition', err);
      }
    });

    eventSource.addEventListener('transcript_message', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        callbacks.onMessage?.(data);
      } catch (err) {
        console.error('Failed to parse SSE message', err);
      }
    });

    eventSource.addEventListener('hitl_required', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        callbacks.onHitlRequired?.(data);
      } catch (err) {
        console.error('Failed to parse SSE hitl_required', err);
      }
    });

    eventSource.addEventListener('session_resolved', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        callbacks.onResolved?.(data);
      } catch (err) {
        console.error('Failed to parse SSE session_resolved', err);
      } finally {
        eventSource?.close();
      }
    });

    eventSource.addEventListener('session_escalated', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        callbacks.onEscalated?.(data);
      } catch (err) {
        console.error('Failed to parse SSE session_escalated', err);
      } finally {
        eventSource?.close();
      }
    });

    eventSource.onerror = (err) => {
      callbacks.onError?.(err);
    };
  } catch (err) {
    callbacks.onError?.(err);
  }

  // Return unsubscribe cleanup function
  return () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };
}

// ── Evidence Vault ───────────────────────────────────────────────────
export interface EvidenceItem {
  id: string;
  case_id: string;
  storage_key: string;
  sha256: string;
  original_filename: string | null;
  content_type: string | null;
  file_size_bytes: number | null;
  validation_status: string;
  ocr_extracted_text: string | null;
  created_at: string;
}

export async function uploadEvidence(caseId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return apiFetch<EvidenceItem>(`/api/cases/${caseId}/evidence`, {
    method: 'POST',
    body: form,
  });
}

export async function listEvidence(caseId: string): Promise<EvidenceItem[]> {
  return apiFetch<EvidenceItem[]>(`/api/cases/${caseId}/evidence`);
}

// ── Legal Research & Dark Patterns ───────────────────────────────────
export interface LegalProvision {
  id: string;
  source_name: string;
  act_or_regulation: string;
  section_or_annexure: string;
  category: string;
  retrieved_text: string;
  relevance_explanation: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  dark_pattern_code: string | null;
}

export async function searchLegalProvisions(
  query?: string,
  category?: string,
  severity?: string
): Promise<{ total: number; results: LegalProvision[] }> {
  const params = new URLSearchParams();
  if (query) params.append('q', query);
  if (category) params.append('category', category);
  if (severity) params.append('severity', severity);

  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<{ total: number; results: LegalProvision[] }>(`/api/v1/legal-research${qs}`);
}

// ── Document Generator ───────────────────────────────────────────────
export interface GeneratedDocument {
  document_id: string;
  case_id: string;
  case_number: string;
  document_type: string;
  title: string;
  content: string;
  created_at: string;
  status: string;
}

export async function generateDocument(
  caseId: string,
  documentType: string,
  customNotes?: string
): Promise<GeneratedDocument> {
  return apiFetch<GeneratedDocument>('/api/v1/documents/generate', {
    method: 'POST',
    body: JSON.stringify({
      case_id: caseId,
      document_type: documentType,
      custom_notes: customNotes,
    }),
  });
}

// ── Actions & Approvals ──────────────────────────────────────────────
export interface ActionItem {
  id: string;
  case_id: string;
  action_type: string;
  status: string;
  payload: string;
  result: string | null;
  created_at: string;
  executed_at: string | null;
}

export async function listActions(caseId: string): Promise<ActionItem[]> {
  return apiFetch<ActionItem[]>(`/api/cases/${caseId}/actions`);
}

export async function approveAction(actionId: string, decision: string, notes?: string) {
  return apiFetch(`/api/actions/${actionId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ decision, notes }),
  });
}

// ── Escalations ──────────────────────────────────────────────────────
export interface EscalationItem {
  id: string;
  case_id: string;
  channel: string;
  reference: string | null;
  status: string;
  details: string;
  submitted_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

export async function createEscalation(caseId: string, channel: string, details: string = '{}') {
  return apiFetch<EscalationItem>(`/api/cases/${caseId}/escalations`, {
    method: 'POST',
    body: JSON.stringify({ channel, details }),
  });
}

export async function listEscalations(caseId: string): Promise<EscalationItem[]> {
  return apiFetch<EscalationItem[]>(`/api/cases/${caseId}/escalations`);
}

// ── Transactions ─────────────────────────────────────────────────────
export interface TransactionItem {
  id: string;
  case_id: string;
  amount: number;
  currency: string;
  transaction_at: string | null;
  order_reference: string | null;
  payment_method: string | null;
  description: string | null;
  created_at: string;
}

export async function addTransaction(caseId: string, data: Record<string, unknown>) {
  return apiFetch<TransactionItem>(`/api/cases/${caseId}/transactions`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listTransactions(caseId: string): Promise<TransactionItem[]> {
  return apiFetch<TransactionItem[]>(`/api/cases/${caseId}/transactions`);
}

// ── Timeline & Audit ─────────────────────────────────────────────────
export interface TimelineEntry {
  timestamp: string;
  event_type: string;
  title: string;
  description: string | null;
  actor: string | null;
  metadata: string | null;
}

export async function getTimeline(caseId: string) {
  return apiFetch<{ case_id: string; entries: TimelineEntry[] }>(`/api/cases/${caseId}/timeline`);
}

export interface AuditItem {
  id: string;
  case_id: string;
  event_type: string;
  timestamp: string;
  actor: string | null;
  payload: string;
}

export async function getAuditTrail(caseId: string): Promise<AuditItem[]> {
  return apiFetch<AuditItem[]>(`/api/audit/${caseId}`);
}
