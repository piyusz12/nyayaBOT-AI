/**
 * Garuda AI — API client for the FastAPI backend.
 * Handles auth tokens, request/response, and error mapping.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ── Token management ───────────────────────────────────────────────
let accessToken: string | null = null;

export function setToken(token: string) {
  accessToken = token;
  if (typeof window !== 'undefined') {
    localStorage.setItem('garuda_token', token);
  }
}

export function getToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== 'undefined') {
    accessToken = localStorage.getItem('garuda_token');
  }
  return accessToken;
}

export function clearToken() {
  accessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('garuda_token');
  }
}

// ── Core fetch wrapper ─────────────────────────────────────────────
async function apiFetch<T>(
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

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (!(options.body instanceof FormData)) {
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

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Auth ───────────────────────────────────────────────────────────
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
    const err = await res.json().catch(() => ({ detail: 'Login failed' }));
    throw new ApiError(res.status, err.detail);
  }

  const data = await res.json();
  setToken(data.access_token);
  return data;
}

export function logout() {
  clearToken();
}

// ── Cases ──────────────────────────────────────────────────────────
export interface CaseSummary {
  id: string;
  case_number: string;
  merchant_name: string;
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

export async function createCase(data: CaseCreateData) {
  return apiFetch<CaseDetail>('/api/cases', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listCases() {
  return apiFetch<CaseSummary[]>('/api/cases');
}

export async function getCase(id: string) {
  return apiFetch<CaseDetail>(`/api/cases/${id}`);
}

export async function updateCase(id: string, data: Record<string, unknown>) {
  return apiFetch<CaseDetail>(`/api/cases/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ── Evidence ───────────────────────────────────────────────────────
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

export async function listEvidence(caseId: string) {
  return apiFetch<EvidenceItem[]>(`/api/cases/${caseId}/evidence`);
}

// ── Transactions ───────────────────────────────────────────────────
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

export async function listTransactions(caseId: string) {
  return apiFetch<TransactionItem[]>(`/api/cases/${caseId}/transactions`);
}

// ── Timeline ───────────────────────────────────────────────────────
export interface TimelineEntry {
  timestamp: string;
  event_type: string;
  title: string;
  description: string | null;
  actor: string | null;
  metadata: string | null;
}

export async function getTimeline(caseId: string) {
  return apiFetch<{ case_id: string; entries: TimelineEntry[] }>(
    `/api/cases/${caseId}/timeline`
  );
}

// ── Actions & Approvals ────────────────────────────────────────────
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

export async function listActions(caseId: string) {
  return apiFetch<ActionItem[]>(`/api/cases/${caseId}/actions`);
}

export async function approveAction(actionId: string, decision: string, notes?: string) {
  return apiFetch(`/api/actions/${actionId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ decision, notes }),
  });
}

// ── Escalations ────────────────────────────────────────────────────
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

export async function listEscalations(caseId: string) {
  return apiFetch<EscalationItem[]>(`/api/cases/${caseId}/escalations`);
}

// ── Audit ──────────────────────────────────────────────────────────
export interface AuditItem {
  id: string;
  case_id: string;
  event_type: string;
  timestamp: string;
  actor: string | null;
  payload: string;
}

export async function getAuditTrail(caseId: string) {
  return apiFetch<AuditItem[]>(`/api/audit/${caseId}`);
}

// ── Dossier ────────────────────────────────────────────────────────
export interface Dossier {
  case_id: string;
  verified_facts: string;
  resolution_constraints: string;
  missing_fields: string;
  evidence_summary: string | null;
  created_at: string;
  updated_at: string;
}

export async function getDossier(caseId: string) {
  return apiFetch<Dossier>(`/api/cases/${caseId}/dossier`);
}
