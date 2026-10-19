# AegisAI Frontend — Implementation Plan

> Next.js 14 App Router + Tailwind CSS + TypeScript
> Theme: Pale olive/cream from `C:\Users\ASUS\OneDrive\Desktop\index.html`
> Port: 3000 (matches CORS config)
> i18n: English + Persian (RTL via Vazirmatn)

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| Next.js 14 (App Router) | Framework, SSR, API routes |
| TypeScript | Type safety |
| Tailwind CSS | Utility-first CSS + theme tokens |
| next-intl | i18n (en/fa) + RTL middleware |
| Zustand | Auth state management |
| react-hook-form + Zod | Form validation |
| lucide-react | Icons |
| ky | HTTP client (wrapper around fetch) |

---

## Directory Structure

```
frontend/
├── public/
├── src/
│   ├── app/
│   │   ├── [locale]/               # i18n wrapper
│   │   │   ├── (marketing)/
│   │   │   │   └── page.tsx        # Landing page
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── register/page.tsx
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx      # Sidebar + header shell
│   │   │   │   ├── dashboard/page.tsx
│   │   │   │   ├── documents/
│   │   │   │   │   ├── page.tsx    # List + upload
│   │   │   │   │   └── [id]/page.tsx
│   │   │   │   ├── search/page.tsx
│   │   │   │   ├── chat/page.tsx
│   │   │   │   ├── approvals/page.tsx
│   │   │   │   ├── audit/page.tsx
│   │   │   │   ├── traces/page.tsx
│   │   │   │   ├── evals/page.tsx
│   │   │   │   ├── settings/page.tsx
│   │   │   │   └── admin/page.tsx
│   │   │   └── layout.tsx          # Root layout (html lang, fonts)
│   │   └── api/
│   │       └── proxy/[...path]/route.ts  # BFF proxy to backend
│   ├── components/
│   │   ├── ui/                     # Button, Card, Input, Badge, Modal, Table
│   │   ├── layout/                 # Sidebar, Header, LangToggle
│   │   ├── auth/                   # LoginForm, RegisterForm
│   │   ├── documents/              # UploadZone, DocumentTable, DocumentDetail
│   │   ├── chat/                   # MessageList, ChatInput, StreamingMessage
│   │   ├── search/                 # SearchBar, SearchResult
│   │   ├── approvals/              # ApprovalCard, ApprovalTable
│   │   ├── traces/                 # TraceTable, SpanTree
│   │   ├── evals/                  # EvalTable, EvalDetail
│   │   └── system/                 # HealthWidget, StatusIndicator
│   ├── lib/
│   │   ├── api.ts                  # ky instance with auth + refresh logic
│   │   ├── auth.ts                 # Token helpers
│   │   └── i18n.ts                 # next-intl config
│   ├── hooks/
│   │   ├── useAuth.ts              # Auth state + login/logout/register
│   │   ├── useDocuments.ts         # CRUD + polling
│   │   ├── useChat.ts              # SSE streaming
│   │   ├── useSearch.ts            # Hybrid search
│   │   └── useApprovals.ts         # Approval queue
│   ├── stores/
│   │   └── authStore.ts            # Zustand auth store
│   ├── messages/
│   │   ├── en.json
│   │   └── fa.json
│   └── styles/
│       └── globals.css             # Theme tokens + Tailwind
├── middleware.ts                    # next-intl middleware
├── tailwind.config.ts
├── next.config.mjs
├── .env.local
└── package.json
```

---

## Theme Tokens (from index.html)

CSS custom properties ported to Tailwind config:

```css
:root {
  --bg: #f3f0e3;
  --text: #293222;
  --muted: #646659;
  --faint: #77796a;
  --accent: #767c4c;
  --warm: #883250;
  --line: #d7d5c6;
  --panel: #ece9dc;
  --serif: Georgia, 'Times New Roman', serif;
  --sans: Inter, Arial, sans-serif;
  --mono: 'IBM Plex Mono', monospace;
}
```

**Fonts** (Google Fonts import):
- Inter (400, 500, 600) — body
- IBM Plex Mono (400, 500) — labels, code, monospace elements
- Vazirmatn (400, 500, 600, 700) — Persian RTL text
- Georgia — headings (serif)

**Noise texture** background: SVG data URI from theme (paper-like grain)

**Component styles to port:**
- `.reading-surface` — pale olive panels with rounded corners
- `.kicker` — monospace uppercase labels with dot indicator
- `.section-head` — numbered sections
- `.skill-tags span` — bordered tag pills
- `.project-row` — grid rows with numbered items
- Status badges (color-coded: gray/yellow/green/red)

---

## Pages — Detailed Spec

### 1. Landing Page (`/`)
**Purpose:** Marketing entry point, CTA to register/login.

**Layout:**
- Hero section: "AegisAI" headline (Georgia serif), subtitle "Production-grade AI knowledge workspace", CTA buttons (Get Started, Learn More)
- Feature cards grid (4-6 cards):
  - Document Ingestion (upload → extract → chunk → embed)
  - Hybrid Search (dense + sparse via Qdrant)
  - AI Chat (streaming LLM with context)
  - Policy Engine (deny-by-default + audit trail)
  - Agent Runtime (LangGraph + MCP tools)
  - Observability (Langfuse tracing + evals)
- Footer with status indicator (polls `/health`)

**Theme:** Reading-surface panel, kicker label "AegisAI", serif headings.

### 2. Login Page (`/[locale]/login`)
**Fields:** email (input), password (input), submit button
**Errors:** 401 → "Invalid credentials", rate limit → "Too many requests"
**Links:** "Don't have an account? Register"
**After login:** Store tokens, redirect to `/dashboard`

### 3. Register Page (`/[locale]/register`)
**Fields:** email, password, confirm password (client-side match validation), submit
**Errors:** 409 → "Email already registered"
**Links:** "Already have an account? Login"
**After register:** Auto-login, redirect to `/dashboard`

### 4. Dashboard (`/[locale]/dashboard`)
**Widgets:**
- Stats cards: Total Documents, Ready/Processing/Failed counts, Health status
- Recent documents list (last 5)
- Health widget: CPU%, Memory%, Uptime (polls `/health` every 30s)
- Quick actions: Upload Document, Start Chat

### 5. Documents Page (`/[locale]/documents`)
**Features:**
- Upload zone (drag-and-drop + file picker, accepts PDF/DOCX/TXT/MD)
- Document table: filename, type, status badge, created date, actions
- Status badges: QUEUED (gray), PROCESSING (yellow spinner), READY (green check), FAILED (red X)
- Polling: auto-refresh document status every 5s while any doc is PROCESSING
- Click row → document detail

### 6. Document Detail (`/[locale]/documents/[id]`)
**Shows:**
- Full metadata (filename, mime, owner, created_at)
- Status tracker (visual pipeline: QUEUED → PROCESSING → READY/FAILED)
- Error display (if FAILED)
- Chunks list (if READY): chunk_index, content preview, token_count
- Actions: Delete (future), Re-process (future)

### 7. Search Page (`/[locale]/search`)
**Features:**
- Search bar with top-k slider
- Results list: source document, chunk heading, highlighted snippet, relevance score, citation number [1], [2], ...
- Click result → jump to document detail
- Empty state: "Search your documents"

### 8. Chat Page (`/[locale]/chat`)
**Features:**
- Message list (scrollable, auto-scroll to bottom)
- User messages (right-aligned, accent bg)
- Assistant messages (left-aligned, panel bg) with streaming text (blinking cursor)
- System message display (collapsible)
- Chat input at bottom with send button, Enter-to-send
- Stop generation button (aborts SSE stream)
- Context panel (sidebar or expandable): shows retrieved sources with citations
- Tool call cards: when agent proposes action, show as a card in chat
- Agent state indicator: reason → propose → gate → execute → verify → respond
- Trace ID display after completion (clickable → traces page)

### 9. Approvals Page (`/[locale]/approvals`)
**Features:**
- Pending approvals table/badge count in sidebar
- Approval detail modal: proposal JSON, graph run context
- Approve / Reject buttons (admin only)
- Approval history table: status, decided_by, timestamps

### 10. Audit Log (`/[locale]/audit`)
**Features (admin only):**
- Filterable table: actor, action, decision (allow/deny badge), reason, created_at
- Expandable JSON view for proposal_json
- Date range filter, search by actor/action

### 11. Traces (`/[locale]/traces`)
**Features (admin/developer):**
- Trace list table: trace_id, start_time, duration, tokens, cost, status
- Trace detail: expandable span tree (gateway → context → llm → tool → verify)
- Click from chat page trace_id link

### 12. Eval Dashboard (`/[locale]/evals`)
**Features (admin/developer):**
- Eval runs table: date, samples, context_recall, faithfulness, pass/fail
- Per-sample detail: question, expected, actual, scores
- Trend chart (optional)

### 13. Settings (`/[locale]/settings`)
**Shows:**
- Provider config: LLM provider, model name, embedding provider
- Feature toggles: reranker enabled, judge enabled
- Threshold config: eval thresholds (admin only)
- Profile: current user email, role, change password

### 14. Admin (`/[locale]/admin`)
**Features (admin only):**
- User list table: email, role, is_active, created_at
- System status: service health indicators

---

## API Proxy (BFF Pattern)

All backend calls go through Next.js API routes to avoid CORS and token exposure:

```
src/app/api/proxy/[...path]/route.ts
```

- Reads token from httpOnly cookie
- Forwards request to `BACKEND_URL/{path}`
- Handles 401 → attempts refresh → retries
- For SSE (chat/stream), streams the response directly

**`.env.local`:**
```
BACKEND_URL=http://localhost:8000
```

---

## Auth Flow

1. Login → store `access_token` + `refresh_token` in httpOnly cookies (via `/api/proxy/auth/login`)
2. API client reads token, attaches `Authorization: Bearer <token>`
3. On 401 → attempt refresh via `/api/proxy/auth/refresh` → if fails → redirect `/login`
4. `useAuth` hook provides: `user`, `login()`, `register()`, `logout()`, `isAuthenticated`
5. RBAC: `user.role` checked client-side for menu visibility + page access

---

## i18n Setup

- `next-intl` with `[locale]` dynamic segment
- Middleware: detect `Accept-Language`, cookie, or URL prefix
- Persian locale (`fa`): `dir="rtl"` on `<html>`, Vazirmatn font loaded
- English locale (`en`): `dir="ltr"`, Inter/Georgia fonts
- Language toggle button in header (matching theme's `.lang-toggle`)

---

## Implementation Order

| Step | What | Est. Time |
|---|---|---|
| 1 | Scaffold Next.js, install deps, configure Tailwind + theme tokens + fonts | 15 min |
| 2 | i18n setup (next-intl, middleware, en/fa translations, RTL) | 15 min |
| 3 | API proxy route + auth store (Zustand) + api client (ky) | 20 min |
| 4 | Layout: Sidebar + Header + LangToggle (responsive, collapsible) | 20 min |
| 5 | Auth pages (Login + Register) | 15 min |
| 6 | Landing page (hero, features, CTA) | 15 min |
| 7 | Dashboard (stats, recent docs, health widget) | 15 min |
| 8 | Documents: list + upload + detail pages | 25 min |
| 9 | Chat page (streaming SSE, context panel) | 20 min |
| 10 | Search page | 10 min |
| 11 | Approvals + Audit Log pages | 15 min |
| 12 | Traces + Eval Dashboard pages | 15 min |
| 13 | Settings + Admin pages | 15 min |
| 14 | Polish: responsive, error states, loading skeletons | 10 min |
| **Total** | | **~4.5 hours** |

---

## Backend Endpoints (existing)

| Method | Path | Auth | Used By |
|---|---|---|---|
| GET | `/health` | No | Dashboard, Landing |
| POST | `/auth/register` | No | Register page |
| POST | `/auth/login` | No | Login page |
| POST | `/auth/refresh` | No | Auto-refresh |
| GET | `/admin/whoami` | JWT + ADMIN | Admin page |
| POST | `/documents` | JWT | Upload |
| GET | `/documents/{id}` | JWT | Document detail |
| POST | `/chat/stream` | JWT | Chat page |

**Missing endpoints (frontend will build UI stubs for):**
- `GET /documents` (list) — needs backend addition
- `GET /search?q=...` — needs backend addition
- `GET /approvals` — needs backend addition (T5.3)
- `POST /approvals/{id}/decision` — needs backend addition (T5.3)
- `GET /audit-log` — needs backend addition (T4.3)
- `GET /traces` — needs backend addition (T6.1)
- `GET /evals` — needs backend addition (T6.2)
