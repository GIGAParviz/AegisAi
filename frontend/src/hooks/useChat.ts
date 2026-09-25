'use client'

import { useCallback, useRef, useState } from 'react'
import { apiStream } from '@/lib/api'
import type { ChatMessage } from '@/lib/types'

interface StreamCallbacks {
  onToken: (token: string) => void
  onDone: (traceId: string) => void
  onError: (error: string, traceId: string) => void
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(async (content: string, callbacks?: Partial<StreamCallbacks>) => {
    const userMessage: ChatMessage = { role: 'user', content }
    setMessages((prev) => [...prev, userMessage])
    setStreaming(true)
    setError(null)

    abortControllerRef.current = new AbortController()

    try {
      const response = await apiStream('/chat/stream', {
        json: { messages: [...messages, userMessage] },
        signal: abortControllerRef.current.signal,
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      if (!reader) throw new Error('No reader available')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const event = line.slice(7)
            const dataLine = lines.shift()
            if (dataLine?.startsWith('data: ')) {
              const data = JSON.parse(dataLine.slice(6))
              switch (event) {
                case 'token':
                  callbacks?.onToken?.(data)
                  break
                case 'done':
                  callbacks?.onDone?.(data.trace_id)
                  break
                case 'error':
                  callbacks?.onError?.(data.error, data.trace_id)
                  break
              }
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message)
        callbacks?.onError?.(err.message, '')
      }
    } finally {
      setStreaming(false)
      abortControllerRef.current = null
    }
  }, [messages])

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort()
    setStreaming(false)
  }, [])

  const addAssistantMessage = useCallback((content: string) => {
    const assistantMessage: ChatMessage = { role: 'assistant', content }
    setMessages((prev) => [...prev, assistantMessage])
  }, [])

  const updateLastAssistantMessage = useCallback((content: string) => {
    setMessages((prev) => {
      const newMessages = [...prev]
      const lastIndex = newMessages.findLastIndex((m) => m.role === 'assistant')
      if (lastIndex >= 0) {
        newMessages[lastIndex] = { ...newMessages[lastIndex], content }
      }
      return newMessages
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
    addAssistantMessage,
    updateLastAssistantMessage,
    clearMessages,
  }
}