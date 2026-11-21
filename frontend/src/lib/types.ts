export interface User {
  id: string
  email: string
  role: 'ADMIN' | 'USER' | 'AGENT'
  is_active: boolean
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface RegisterRequest {
  email: string
  password: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RefreshRequest {
  refresh_token: string
}

export interface Document {
  id: string
  filename: string
  mime: string
  status: 'queued' | 'processing' | 'ready' | 'failed'
  error: string | null
  owner_id: string
  created_at: string
}

export const documentStatusMessage = {
  queued: 'statusQueued',
  processing: 'statusProcessing',
  ready: 'statusReady',
  failed: 'statusFailed',
} as const satisfies Record<Document['status'], string>

export interface DocumentChunk {
  id: string
  document_id: string
  chunk_index: number
  content: string
  token_count: number
  created_at: string
}

export interface Citation { document_id: string; chunk_index?: number; text?: string; content?: string; filename?: string; heading?: string | null; score?: number }

export interface WebCitation { url: string; title: string; end_index: number }

export interface ChatMessage {
  web_citations?: WebCitation[]
  citations?: Citation[]
  trace_id?: string
  document_ids?: string[]
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  web_search?: boolean
  document_ids?: string[]
  session_id?: string
  messages: ChatMessage[]
}

export interface HealthResponse {
  status: string
  system: {
    'CPU Percent': number
    'Memory Percent': number
    UpTime: number
  }
}

export interface SearchResult {
  document_id: string
  chunk_index: number
  text: string
  score: number
  heading: string | null
}

export interface Approval {
  id: string
  graph_run_id: string
  proposal_json: Record<string, unknown>
  status: 'pending' | 'approved' | 'rejected'
  decided_by: string | null
  created_at: string
}

export interface PolicyAudit {
  id: string
  actor: string
  action: string
  decision: 'allow' | 'deny'
  reason: string
  proposal_json: Record<string, unknown>
  created_at: string
}

export interface Trace {
  trace_id: string
  start_time: string
  duration: number
  tokens: number
  cost: number
  status: 'success' | 'error'
}
