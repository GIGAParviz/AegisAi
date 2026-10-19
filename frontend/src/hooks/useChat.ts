'use client'

import { useCallback, useRef, useState } from 'react'
import { getAuthToken } from '@/lib/auth-token'
import type { ChatMessage } from '@/lib/types'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

interface StreamCallbacks {
  onToken: (token: string) => void
  onDone: (traceId: string) => void
  onError: (error: string, traceId: string) => void
}

/** Parse SSE text blocks ("event: x\ndata: y\n\n") correctly — the previous
 *  implementation shifted lines mid-iteration and dropped events. */
function parseSSEBlocks(buffer: string): { blocks: { event: string; data: string }[]; rest: string } {
  const parts = buffer.split('\n\n')
  const rest = parts.pop() ?? ''
  const blocks: { event: string; data: string }[] = []
  for (const block of parts) {
    let event = 'message'
    let data = ''
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data += line.slice(5).trim()
    }
    if (data) blocks.push({ event, data })
  }
  return { blocks, rest }
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async (content: string, callbacks?: Partial<StreamCallbacks>) => {
      const history: ChatMessage[] = [...messages, { role: 'user', content }]
      setMessages([...history, { role: 'assistant', content: '' }])
      setStreaming(true)
      setError(null)

      abortRef.current = new AbortController()
      let gotTokens = false
      let lastTraceId = ''

      try {
        const token = getAuthToken()
        const response = await fetch(`${BACKEND_URL}/chat/stream`, {
          method: 'POST',
          signal: abortRef.current.signal,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ messages: history }),
        })

        if (!response.ok || !response.body) {
          throw new Error(`Request failed (${response.status})`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const { blocks, rest } = parseSSEBlocks(buffer)
          buffer = rest

          for (const { event, data } of blocks) {
            if (event === 'token') {
              const piece = JSON.parse(data) as string
              gotTokens = true
              callbacks?.onToken?.(piece)
            } else if (event === 'done') {
              const parsed = JSON.parse(data) as { trace_id?: string }
              lastTraceId = parsed.trace_id ?? ''
              callbacks?.onDone?.(lastTraceId)
            } else if (event === 'error') {
              const parsed = JSON.parse(data) as { error?: string; trace_id?: string }
              setError(parsed.error ?? 'stream_failed')
              callbacks?.onError?.(parsed.error ?? 'stream_failed', parsed.trace_id ?? '')
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message)
          callbacks?.onError?.(err.message, lastTraceId)
        }
      } finally {
        // Drop an empty assistant bubble if the stream produced nothing
        if (!gotTokens) {
          setMessages((prev) => {
            const copy = [...prev]
            const last = copy[copy.length - 1]
            if (last?.role === 'assistant' && last.content === '') copy.pop()
            return copy
          })
        }
        setStreaming(false)
        abortRef.current = null
      }
    },
    [messages],
  )

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
  }, [])

  const appendAssistantToken = useCallback((tokenPiece: string) => {
    setMessages((prev) => {
      const copy = [...prev]
      const last = copy[copy.length - 1]
      if (last?.role === 'assistant') {
        copy[copy.length - 1] = { ...last, content: last.content + tokenPiece }
      }
      return copy
    })
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return {
    messages,
    streaming,
    error,
    sendMessage,
    stopStreaming,
    appendAssistantToken,
    clearMessages,
  }
}
