'use client'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Bot, FileText, Paperclip, Send, Square, Trash2, X, RefreshCw, BookOpen } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useChat } from '@/hooks/useChat'
import { loadDocuments, refreshPending, uploadDocument, useDocuments } from '@/hooks/useDocuments'
import { errorMessage } from '@/lib/workspace-api'
import type { ChatMessage, Document } from '@/lib/types'
function Message({ message, documents }: { message: ChatMessage; documents: Document[] }) {
  const t = useTranslations('chat'), u = message.role === 'user'
  return <article className={`chat-message ${u ? 'is-user' : ''}`}><span className="studio-icon">{u ? <span>{t('you')}</span> : <Bot size={20} />}</span><div className="min-w-0 flex-1"><p className="mb-2 text-xs font-medium text-muted">{u ? t('you') : 'Aegis'}</p><p className="whitespace-pre-wrap break-words leading-7">{message.content || '…'}</p>
    {!!message.document_ids?.length && <p className="mt-2 text-xs opacity-70">{message.document_ids.map(id => documents.find(d => d.id === id)?.filename ?? id).join(' · ')}</p>}
    {!!message.citations?.length && <div className="citation-list"><p className="eyebrow">{t('sources')}</p>{message.citations.map((citation, i) => <details key={`${citation.document_id}-${i}`} className="citation"><summary><BookOpen size={14} /><span>{citation.filename ?? documents.find(d => d.id === citation.document_id)?.filename ?? citation.document_id}</span><span className="ms-auto font-mono text-xs">{citation.chunk_index !== undefined ? `#${citation.chunk_index}` : i + 1}</span></summary>{citation.heading && <p className="px-3 pt-3 text-xs font-medium text-muted">{citation.heading}</p>}<p className="whitespace-pre-wrap p-3 text-sm">{citation.text ?? citation.content ?? t('sourceNoExcerpt')}</p><p className="px-3 pb-3 font-mono text-xs text-muted" dir="ltr">{citation.document_id}</p></details>)}</div>}
    {message.trace_id && <p className="mt-3 break-all font-mono text-[10px] text-faint">{t('traceBadge')}: {message.trace_id}</p>}
  </div></article>
}
export default function ChatWorkspace() {
  const t = useTranslations('chat'), d = useTranslations('documents'), c = useTranslations('common')
  const params = useSearchParams(), docParam = params.get('doc')
  const { messages, streaming, error, sendMessage, clearMessages, stopStreaming } = useChat()
  const { documents, loading, error: documentsError } = useDocuments()
  const [selected, setSelected] = useState<string[]>(docParam ? [docParam] : []), [input, setInput] = useState(''), [uploads, setUploads] = useState<string[]>([]), [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null), bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => { bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { const timer = setInterval(() => { void refreshPending().catch(async e => setUploadError(await errorMessage(e))) }, 2500); return () => clearInterval(timer) }, [])
  const selectedDocs = documents.filter(doc => selected.includes(doc.id)), readyIds = selectedDocs.filter(doc => doc.status === 'READY').map(doc => doc.id)
  const blocked = uploads.length > 0 || selected.some(id => !readyIds.includes(id))
  function toggle(id: string) { setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]) }
  async function attach(files: FileList | null) {
    if (!files) return
    setUploadError('')
    for (const file of Array.from(files)) {
      if (!/\.(pdf|docx|txt|md)$/i.test(file.name) || file.size > 50 * 1024 * 1024) { setUploadError(t('invalidFile')); continue }
      setUploads(prev => [...prev, file.name])
      try { const doc = await uploadDocument(file); setSelected(prev => [...new Set([...prev, doc.id])]) } catch (e) { setUploadError(`${file.name}: ${await errorMessage(e)}`) } finally { setUploads(prev => { const next = [...prev]; next.splice(next.indexOf(file.name), 1); return next }) }
    }
    if (fileRef.current) fileRef.current.value = ''
  }
  async function submit() { if (!input.trim() || streaming || blocked) return; const text = input.trim(); setInput(''); await sendMessage(text, { documentIds: readyIds }) }
  const statusLabel = (status: Document['status']) => d(`status${status[0]}${status.slice(1).toLowerCase()}`)
  return <div className="chat-workspace">
    <div className="chat-main"><div className="flex items-center justify-between border-b border-line px-5 py-4"><div><p className="eyebrow">{t('workspace')}</p><h1 className="display text-2xl">{t('title')}</h1></div><button onClick={clearMessages} disabled={streaming || !messages.length} className="studio-icon" aria-label={t('clear')}><Trash2 size={17} /></button></div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8"><div className="mx-auto max-w-3xl space-y-6">
        {!messages.length && <div className="chat-welcome"><span className="studio-icon"><Bot size={30} /></span><p className="eyebrow mt-6">{t('grounded')}</p><h2 className="display mt-3 text-4xl">{t('startConversation')}</h2><p className="mx-auto mt-4 max-w-md text-muted">{t('attachHint')}</p><div className="mt-7 flex flex-wrap justify-center gap-2">{['s1', 's2', 's3'].map(key => <button className="suggestion" key={key} onClick={() => setInput(t(`suggestions.${key}`))}>{t(`suggestions.${key}`)}</button>)}</div></div>}
        {messages.map((m, i) => <Message key={i} message={m} documents={documents} />)}
        {streaming && <p role="status" className="text-sm text-muted animate-pulse">{t('thinking')}</p>}
        {error && <div className="studio-error" role="alert">{t('backendError')}<p className="mt-1 text-xs">{error}</p></div>}<div ref={bottomRef} />
      </div></div>
      <div className="chat-composer"><div className="mx-auto max-w-3xl">
        <div className="mb-2 flex flex-wrap gap-2">{selected.map(id => { const doc = documents.find(d => d.id === id); return <span key={id} data-testid="attachment-chip" className={`attachment-chip ${doc?.status === 'FAILED' ? 'failed' : ''}`}><FileText size={13} /><span className="max-w-40 truncate">{doc?.filename ?? id}</span><small>{doc ? statusLabel(doc.status) : c('loading')}</small><button aria-label={`${t('removeAttachment')} ${doc?.filename ?? id}`} onClick={() => toggle(id)} disabled={streaming}><X size={13} /></button></span> })}{uploads.map((name, i) => <span className="attachment-chip" key={`${name}-${i}`} role="status">{name} · {d('uploading')}</span>)}</div>
        {uploadError && <p className="mb-2 text-sm text-warm" role="alert">{uploadError}</p>}
        <div className="composer-box"><button className="studio-icon" onClick={() => fileRef.current?.click()} disabled={streaming} aria-label={t('attach')} data-testid="attach-file"><Paperclip size={20} /></button><input ref={fileRef} type="file" multiple accept=".pdf,.docx,.txt,.md" className="sr-only" aria-label={t('attach')} data-testid="chat-file-input" onChange={e => { void attach(e.target.files) }} />
          <textarea aria-label={t('placeholder')} data-testid="chat-input" rows={2} value={input} onChange={e => setInput(e.target.value)} placeholder={t('placeholder')} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit() } }} />
          <button className="composer-send" data-testid={streaming ? 'stop-chat' : 'send-chat'} onClick={streaming ? stopStreaming : submit} disabled={!streaming && (!input.trim() || blocked)} aria-label={streaming ? t('stop') : t('send')}>{streaming ? <Square size={18} /> : <Send size={18} className="rtl:-scale-x-100" />}</button>
        </div><p className="mt-2 text-xs text-muted">{blocked ? t('waitForFiles') : t('composerHint')}</p>
      </div></div>
    </div>
    <aside className="chat-library" aria-label={t('library')}><div className="flex items-center justify-between"><h2 className="display text-xl">{t('library')}</h2><button aria-label={c('refresh')} onClick={() => { void loadDocuments().catch(() => {}) }} className="studio-icon"><RefreshCw size={15} /></button></div><p className="my-3 text-xs text-muted">{t('libraryHint')}</p>
      {documentsError && <p className="studio-error" role="alert">{documentsError}</p>}{loading && <p role="status" className="text-sm">{c('loading')}</p>}
      {!loading && !documents.length && <div className="studio-empty"><FileText size={28} /><p>{d('noDocuments')}</p><small>{t('attachHint')}</small></div>}
      <div className="mt-3 space-y-2">{documents.map(doc => <label key={doc.id} className={`library-document ${selected.includes(doc.id) ? 'selected' : ''}`}><input type="checkbox" aria-label={`${t('selectDocument')} ${doc.filename}`} checked={selected.includes(doc.id)} disabled={streaming || doc.status === 'FAILED'} onChange={() => toggle(doc.id)} /><span className="min-w-0"><span className="block truncate text-sm font-medium">{doc.filename}</span><span className={`doc-status ${doc.status.toLowerCase()}`}>{statusLabel(doc.status)}</span>{doc.error && <span className="block break-words text-xs text-warm">{doc.error}</span>}</span></label>)}</div>
      <div className="mt-auto pt-6 text-xs text-muted"><p>{t('privacy')}</p></div>
    </aside>
  </div>
}
