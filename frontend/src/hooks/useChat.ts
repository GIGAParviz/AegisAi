'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getAuthToken } from '@/lib/auth-token'
import type { ChatMessage, Citation } from '@/lib/types'
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
interface SendOptions { documentIds?: string[]; sessionId?: string; onToken?: (token: string) => void; onDone?: (trace: string) => void; onError?: (error: string, trace: string) => void }
export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]), [streaming, setStreaming] = useState(false), [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => () => abortRef.current?.abort(), [])
  const sendMessage = useCallback(async (content: string, options: SendOptions = {}) => {
    if (abortRef.current) return
    const history: ChatMessage[] = [...messages, { role: 'user', content, document_ids: options.documentIds }]
    setMessages([...history, { role: 'assistant', content: '' }]); setStreaming(true); setError(null)
    const controller = new AbortController(); abortRef.current = controller
    let complete = false, errorTrace = ''
    function updateLast(patch: Partial<ChatMessage>, token?: string) { setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, ...patch, content: token === undefined ? m.content : m.content + token } : m)) }
    function parse(block: string) {
      let event = 'message'; const data: string[] = []
      for (const line of block.split(/\r?\n/)) { if (line.startsWith('event:')) event = line.slice(6).trim(); if (line.startsWith('data:')) data.push(line.slice(5).trimStart()) }
      if (!data.length) return
      const parsed = JSON.parse(data.join('\n'))
      if (event === 'token') { const token = typeof parsed === 'string' ? parsed : parsed.token ?? ''; updateLast({}, token); options.onToken?.(token) }
      if (event === 'done') { complete = true; updateLast({ trace_id: parsed.trace_id, citations: Array.isArray(parsed.citations) ? parsed.citations as Citation[] : [] }); options.onDone?.(parsed.trace_id ?? '') }
      if (event === 'error') { errorTrace = parsed.trace_id ?? ''; updateLast({ trace_id: errorTrace }); throw new Error(parsed.error ?? 'Stream failed') }
    }
    try {
      const token = getAuthToken()
      const response = await fetch(`${BACKEND_URL}/chat/stream`, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })), document_ids: options.documentIds ?? [], ...(options.sessionId ? { session_id: options.sessionId } : {}) }) })
      if (!response.ok || !response.body) { let detail = `Request failed (${response.status})`; try { const data = await response.json(); if (typeof data.detail === 'string') detail = data.detail } catch {} throw new Error(detail) }
      const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = ''
      try {
        for (;;) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); let match: RegExpExecArray | null; while ((match = /\r?\n\r?\n/.exec(buffer))) { parse(buffer.slice(0, match.index)); buffer = buffer.slice(match.index + match[0].length) } }
        buffer += decoder.decode(); if (buffer.trim()) parse(buffer)
      } finally { reader.releaseLock() }
      if (!complete) throw new Error('Stream ended before completion')
    } catch (e) { if (!controller.signal.aborted) { const message = e instanceof Error ? e.message : String(e); setError(message); options.onError?.(message, errorTrace) } }
    finally { setStreaming(false); abortRef.current = null }
  }, [messages])
  const stopStreaming = useCallback(() => { abortRef.current?.abort() }, [])
  const clearMessages = useCallback(() => { if (!abortRef.current) { setMessages([]); setError(null) } }, [])
  return { messages, streaming, error, sendMessage, stopStreaming, clearMessages }
}
