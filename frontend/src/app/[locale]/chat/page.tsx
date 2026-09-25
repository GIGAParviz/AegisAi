'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { Loader2, Send, X, Copy, MessageSquare, Sparkles, Bot, User, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { useChat } from '@/hooks/useChat'
import { apiStream } from '@/lib/api'
import { useSearchParams } from 'next/navigation'
import type { ChatMessage } from '@/lib/types'

function MessageList({ messages, streaming, scrollToBottom }: { messages: ChatMessage[]; streaming: boolean; scrollToBottom: () => void }) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollToBottom()
  }, [messages, streaming, scrollToBottom])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center text-muted">
        <MessageSquare className="h-16 w-16 mb-4 text-faint" />
        <h3 className="text-lg font-medium text-text mb-2">Start a conversation</h3>
        <p className="text-sm max-w-md">Ask questions, get answers with citations from your documents, or explore ideas with the AI assistant.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6" role="log" aria-live="polite">
      {messages.map((message, index) => (
        <div
          key={index}
          className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
        >
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              message.role === 'user'
                ? 'bg-accent text-white'
                : message.role === 'system'
                ? 'bg-warm/10 text-warm border border-warm/20'
                : 'bg-panel border border-line'
            }`}
          >
            {message.role === 'user' ? (
              <User className="h-4 w-4" />
            ) : message.role === 'system' ? (
              <Sparkles className="h-4 w-4" />
            ) : (
              <Bot className="h-4 w-4 text-accent" />
            )}
          </div>
          <div
            className={`flex-1 max-w-[85%] ${
              message.role === 'user' ? 'text-right' : ''
            }`}
          >
            <div
              className={`inline-block px-4 py-3 rounded-2xl ${
                message.role === 'user'
                  ? 'bg-accent text-white rounded-br-md'
                  : message.role === 'system'
                  ? 'bg-warm/5 text-text border border-warm/20 rounded-bl-md'
                  : 'bg-panel border border-line rounded-bl-md'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
            {message.role === 'assistant' && index === messages.length - 1 && streaming && (
              <div className="flex items-center gap-1 mt-1 text-muted text-xs">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Streaming...</span>
              </div>
            )}
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  )
}

function ChatInput({ input, setInput, handleSubmit, handleKeyDown, streaming, stopStreaming, clearMessages, textareaRef }: {
  input: string
  setInput: (value: string) => void
  handleSubmit: (e: React.FormEvent) => void
  handleKeyDown: (e: React.KeyboardEvent) => void
  streaming: boolean
  stopStreaming: () => void
  clearMessages: () => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}) {
  return (
    <form onSubmit={handleSubmit} className="p-4 border-t border-line bg-panel/50">
      <div className="flex items-end gap-3">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Shift+Enter for new line)"
            className="w-full px-4 py-3 bg-white border border-line rounded-xl text-text placeholder-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent min-h-[48px] max-h-[150px]"
            disabled={streaming}
            rows={1}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="submit"
            variant={streaming ? 'secondary' : 'primary'}
            size="lg"
            disabled={!input.trim() || streaming}
            onClick={streaming ? stopStreaming : handleSubmit}
          >
            {streaming ? (
              <>
                <X className="h-5 w-5" />
                Stop
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={clearMessages}
            disabled={false}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </form>
  )
}

function ContextPanel({ showContext, setShowContext, contextSources }: { showContext: boolean; setShowContext: (v: boolean) => void; contextSources: unknown[] }) {
  if (!showContext) return null

  return (
    <div className="w-80 lg:w-96 border-l border-line bg-panel/50 flex flex-col">
      <div className="p-4 border-b border-line flex items-center justify-between">
        <h3 className="font-medium text-text">Context</h3>
        <Button variant="ghost" size="sm" onClick={() => setShowContext(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {contextSources.length === 0 ? (
          <div className="text-center text-muted py-8">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 text-faint" />
            <p className="text-sm">No context sources yet</p>
            <p className="text-xs text-faint">Send a message to see retrieved sources</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contextSources.map((source, index) => (
              <div key={index} className="p-3 bg-panel border border-line rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs text-muted">Source #{index + 1}</span>
                  <Badge variant="neutral" className="text-xs">0.95</Badge>
                </div>
                <p className="text-sm text-text line-clamp-2">Sample context content...</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ChatPage() {
  const searchParams = useSearchParams()
  const initialDocId = searchParams.get('doc')
  
  const {
    messages,
    streaming,
    error,
    sendMessage,
    stopStreaming,
    addAssistantMessage,
    updateLastAssistantMessage,
    clearMessages,
  } = useChat()

  const [input, setInput] = useState('')
  const [contextDocId, setContextDocId] = useState<string | null>(initialDocId)
  const [showContext, setShowContext] = useState(false)
  const [contextSources, setContextSources] = useState<unknown[]>([])
  const [traceId, setTraceId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    // The MessageList component handles scrolling
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || streaming) return

    const userInput = input
    setInput('')
    textareaRef.current?.focus()

    let assistantContent = ''
    let currentTraceId: string | null = null

    await sendMessage(userInput, {
      onToken: (token: string) => {
        assistantContent += token
        updateLastAssistantMessage(assistantContent)
      },
      onDone: (traceId: string) => {
        currentTraceId = traceId
        setTraceId(traceId)
      },
      onError: (error: string, traceId: string) => {
        setTraceId(traceId)
      },
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="kicker">Chat</p>
          <h1>AI Assistant</h1>
        </div>
        <div className="flex items-center gap-2">
          {contextDocId && (
            <Badge variant="info" className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Context: {contextDocId.slice(0, 8)}...
            </Badge>
          )}
          {traceId && (
            <Badge variant="neutral" className="font-mono text-xs">
              Trace: {traceId.slice(0, 8)}...
            </Badge>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          <MessageList messages={messages} streaming={streaming} scrollToBottom={scrollToBottom} />
          <ChatInput
            input={input}
            setInput={setInput}
            handleSubmit={handleSubmit}
            handleKeyDown={handleKeyDown}
            streaming={streaming}
            stopStreaming={stopStreaming}
            clearMessages={clearMessages}
            textareaRef={textareaRef}
          />
        </div>

        <ContextPanel
          showContext={showContext}
          setShowContext={setShowContext}
          contextSources={contextSources}
        />
      </div>
    </div>
  )
}