'use client'

import { useTranslations } from 'next-intl'
import { clsx } from 'clsx'
import {
  Bot,
  Send,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { StatusPill } from '@/components/ui/StatusPill'
import { useChat } from '@/hooks/useChat'
import type { ChatMessage } from '@/lib/types'

function Bubble({ message, streaming }: { message: ChatMessage; streaming: boolean }) {
  const isUser = message.role === 'user'
  return (
    <div className={clsx('flex gap-3', isUser && 'flex-row-reverse')}>
      <span
        className={clsx(
          'grid size-8 shrink-0 place-items-center rounded-full',
          isUser ? 'bg-accent text-paper' : 'border border-line bg-paper text-accent',
        )}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </span>
      <div
        className={clsx(
          'max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed',
          isUser
            ? 'rounded-ee-md bg-accent text-paper'
            : 'rounded-ss-md border border-line bg-panel text-text',
        )}
      >
        <p className="whitespace-pre-wrap">
          {message.content}
          {!isUser && streaming && message.content === '' && (
            <span className="inline-flex items-center gap-2 text-sm text-muted">
              <Sparkles className="size-3.5 animate-pulse" />…
            </span>
          )}
        </p>
      </div>
    </div>
  )
}

export default function ChatWorkspacePage() {
  const t = useTranslations('chat')
  const tc = useTranslations('common')
  const searchParams = useSearchParams()
  const docParam = searchParams.get('doc')

  const { messages, streaming, error, sendMessage, stopStreaming, appendAssistantToken, clearMessages } =
    useChat()

  const [input, setInput] = useState('')
  const [traceId, setTraceId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollDown = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollDown()
  }, [messages, streaming, scrollDown])

  const submit = async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    setTraceId(null)
    await sendMessage(text, { onToken: appendAssistantToken, onDone: (tid) => setTraceId(tid || null) })
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const suggestions = [t('suggestions.s1'), t('suggestions.s2'), t('suggestions.s3')]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Compact page bar */}
      <div className="flex items-center justify-between gap-3 border-b border-line bg-bg/70 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <p className="display shrink-0 text-[19px] leading-none">{t('title')}</p>
          {streaming && <StatusPill tone="warn" label={t('streaming')} pulse />}
          {!streaming && !error && <StatusPill tone="ok" label={tc('live')} />}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {docParam && (
            <span className="hidden max-w-[18ch] truncate rounded-full border border-line bg-paper px-2.5 py-1 font-mono text-[10px] text-muted md:block">
              doc:{' '}
              {docParam.slice(0, 8)}
            </span>
          )}
          {traceId && (
            <button
              onClick={() => setTraceId(null)}
              title={traceId}
              className="flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 font-mono text-[10px] text-faint transition-colors hover:text-text"
            >
              {t('traceBadge')}: {traceId.slice(0, 8)}
              <X className="size-3" />
            </button>
          )}
          <button
            onClick={clearMessages}
            disabled={messages.length === 0 || streaming}
            aria-label={t('clear')}
            className="rounded-lg border border-line bg-paper/60 p-1.5 text-muted transition-colors hover:bg-panel hover:text-warm disabled:opacity-40"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          {messages.length === 0 ? (
            <div className="fade-up flex flex-col items-center py-16 text-center">
              <span className="grid size-14 place-items-center rounded-2xl border border-line bg-paper text-accent shadow-soft">
                <Bot className="size-7" />
              </span>
              <h2 className="display mt-5 text-3xl">{t('startConversation')}</h2>
              <p className="prose-serif mt-2 max-w-md text-[15.5px] leading-relaxed text-muted">
                {t('askQuestions')}
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setInput(s)
                      textareaRef.current?.focus()
                    }}
                    className="rounded-full border border-line bg-paper px-4 py-2 text-[13.5px] text-muted transition-colors hover:border-accent/40 hover:bg-panel hover:text-text"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <Bubble key={i} message={m} streaming={streaming && i === messages.length - 1} />
            ))
          )}

          {error && (
            <div className="flex items-center gap-2 self-center rounded-xl border border-warm/30 bg-[#f3e2e8] px-4 py-2.5 text-sm text-warm" role="alert">
              {t('backendError')}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-line bg-bg/80 px-4 py-4 backdrop-blur-sm sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <div className="card-paper flex items-end gap-2 p-2 shadow-lift">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t('placeholder')}
              rows={1}
              className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] text-text outline-none placeholder:text-faint"
              style={{ height: 'auto' }}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = `${Math.min(el.scrollHeight, 160)}px`
              }}
            />
            {streaming ? (
              <button
                onClick={stopStreaming}
                aria-label={t('stop')}
                className="grid size-11 shrink-0 place-items-center rounded-xl border border-warm/30 bg-[#f3e2e8] text-warm transition-colors hover:bg-[#eecdd8]"
              >
                <X className="size-5" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!input.trim()}
                aria-label={t('send')}
                className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-paper transition-colors hover:bg-accent-deep disabled:opacity-40"
              >
                <Send className="size-5 rtl:-scale-x-100" />
              </button>
            )}
          </div>
          <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-wider text-faint">
            {t('composerHint')}
          </p>
        </div>
      </div>
    </div>
  )
}
