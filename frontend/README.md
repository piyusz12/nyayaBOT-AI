# PS 30 Counter-Agent Frontend

> **Legal-Tech & AI Operations Dashboard for Multi-Agent Consumer Dispute Resolution**

This is the production frontend for **PS 30 Counter-Agent**, built using Next.js 16 (App Router), TypeScript, and a tailored Enterprise Legal-Tech design system.

---

## 🏛️ Application Architecture & Navigation

The frontend provides 10 key operational workspaces:

1. **Executive Dashboard (`/`)**: Real-time KPI metrics, 6-stage case pipeline ribbon, attention banners, and live system activity feed.
2. **Dispute Dossiers (`/cases`)**: Filterable, searchable portfolio of active consumer claims.
3. **Multi-Step Intake Wizard (`/cases/new`)**: 4-step intake checking merchant details, RBI pre-debit notices, 50MB multi-evidence upload, and resolution floors.
4. **Dossier Details & Evidence Workspace (`/cases/[id]`)**: Deep case workspace with tabbed Overview, Evidence Ledger with OCR viewer, Legal Analysis, and Audit Timeline.
5. **Live AI Negotiation Console (`/negotiations`)**: 3-panel flagship console with target case context, real-time SSE conversation streaming, and 6-stage autonomous agent execution monitor with $S_{\max}(t)$ similarity scores.
6. **HITL Settlement Approval Center (`/approvals`)**: Governance center displaying haircut analysis, explicit Approve / Reject controls, and supervisor audit notes.
7. **Evidence Vault (`/evidence`)**: Centralized repository of receipts, invoices, screenshots, with SHA-256 integrity hashes and OCR text previews.
8. **Legal Research & Dark-Pattern Index (`/legal-research`)**: Grounded statutory research interface spanning the Consumer Protection Act 2019 and CCPA 2023 Dark Pattern Guidelines.
9. **Escalation Control Center (`/escalations`)**: Multi-channel statutory escalation console (GRO, NCH 1915, Bank E-Mandate, e-Jagriti).
10. **Document Generator (`/documents`)**: Generates formal legal notices, chronological event lists, evidence tables, and consumer complaint drafts with print/copy controls.
11. **Tamper-Evident Audit Trail (`/audit`)**: Immutable log of all platform interactions with JSON payload inspector.
12. **Platform Settings & Governance (`/settings`)**: Backend health ping (`/api/health`), loop detection threshold settings, and DPDP Act 2023 compliance notices.
13. **Authentication (`/login`)**: Operator login with One-Click Demo Mode for instant review.

---

## 🎨 Design System

- **Surfaces**: Dark navy/charcoal (`#0a0e17`, `#101726`, `#162036`).
- **Accents**: Subtle cyan (`#00e5ff`) and royal blue (`#2563eb`).
- **Semantic Colors**: Green (`#10b981`) for verified/resolved, Amber (`#f59e0b`) for pending approval, Red (`#ef4444`) for high-severity/killswitch.
- **Typography**: Clean monospace & tabular numerals for legal amounts, dates, and hash digests.

---

## ⚙️ Environment Variables

Create `.env.local` based on `.env.example`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

---

## 🧪 Testing & Verification

Run the built-in Node 22 test suite:

```bash
npm test
```

Build the production Next.js bundle:

```bash
npm run build
```

Start the development server:

```bash
npm run dev
```
