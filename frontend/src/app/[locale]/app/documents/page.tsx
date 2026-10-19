'use client'

import { useTranslations } from 'next-intl'
import { clsx } from 'clsx'
import {
  ArrowRight,
  CircleDashed,
  Loader2,
  RefreshCw,
  TriangleAlert,
  UploadCloud,
} from 'lucide-react'
import { useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageBody } from '@/components/layout/WorkspaceShell'
import { StatusPill } from '@/components/ui/StatusPill'
import { refreshPending, uploadDocument, useDocuments } from '@/hooks/useDocuments'
import { Link } from '@/lib/navigation'
import type { Document } from '@/lib/types'

function statusTone(status: Document['status']) {
  switch (status) {
    case 'READY':
      return 'ok' as const
    case 'PROCESSING':
    case 'QUEUED':
      return 'warn' as const
    case 'FAILED':
      return 'danger' as const
  }
}

export default function DocumentsPage() {
  const t = useTranslations('documents')
  const tc = useTranslations('common')
  const { documents, uploading, error, setError, setUploading } = useDocuments()

  // Poll pending uploads so statuses advance without a reload.
  useEffect(() => {
    const pending = documents.some((d) => d.status === 'QUEUED' || d.status === 'PROCESSING')
    if (!pending) return
    const id = setInterval(refreshPending, 5000)
    return () => clearInterval(id)
  }, [documents])

  const onDrop = useCallback(
    async (accepted: File[]) => {
      setError(null)
      setUploading(true)
      for (const file of accepted) {
        try {
          await uploadDocument(file)
        } catch (err) {
          const message = err instanceof Error ? err.message : ''
          setError(
            message.includes('415') || message.includes('422')
              ? `${t('uploadFailed')}: ${file.name}`
              : `${file.name} — ${message}`,
          )
        }
      }
      setUploading(false)
    },
    [setError, setUploading, t],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 50 * 1024 * 1024,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md', '.markdown'],
    },
  })

  return (
    <PageBody className="fade-up">
      <PageHeader
        kicker="Knowledge"
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          documents.some((d) => d.status !== 'READY' && d.status !== 'FAILED') ? (
            <button
              onClick={refreshPending}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-paper/60 px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-panel hover:text-text"
            >
              <RefreshCw className="size-4" />
              {tc('refresh')}
            </button>
          ) : undefined
        }
      />

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={clsx(
          'mt-8 cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-colors sm:p-10',
          isDragActive
            ? 'border-accent bg-[#e9efdd]'
            : 'border-line bg-paper/50 hover:border-accent/50 hover:bg-paper',
          uploading && 'pointer-events-none opacity-70',
        )}
      >
        <input {...getInputProps()} />
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-accent/10 text-accent">
          {uploading ? <Loader2 className="size-6 animate-spin" /> : <UploadCloud className="size-6" />}
        </span>
        <p className="mt-3 font-medium text-text">
          {uploading ? t('uploading') : isDragActive ? t('dragDrop') : t('dragDrop')}
        </p>
        <p className="mt-1 font-mono text-xs uppercase tracking-wider text-faint">
          {t('acceptedTypes')}
        </p>
      </div>

      {error && (
        <div role="alert" className="mt-4 flex items-center gap-2 rounded-xl border border-warm/30 bg-[#f3e2e8] px-4 py-3 text-sm text-warm">
          <TriangleAlert className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Local-library note */}
      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-faint">
        <CircleDashed className="mt-px size-3.5 shrink-0" />
        {t('localNote')}
      </p>

      {/* Document table */}
      <section className="card-paper mt-6 overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-line px-5 py-3 sm:grid-cols-[1fr_120px_140px_100px]">
          <p className="font-mono text-[10px] uppercase tracking-wider text-faint">{t('filename')}</p>
          <p className="hidden font-mono text-[10px] uppercase tracking-wider text-faint sm:block">{t('type')}</p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-faint">{t('status')}</p>
          <p className="hidden text-end font-mono text-[10px] uppercase tracking-wider text-faint sm:block">{t('actions')}</p>
        </div>

        {documents.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <UploadCloud className="mx-auto mb-3 size-10 text-faint" />
            <p className="font-medium">{t('noDocuments')}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{t('noDocumentsHint')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {documents.map((doc) => (
              <li key={doc.id}>
                <Link
                  href={`/app/documents/${doc.id}`}
                  className="group grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[#eef0e2] sm:grid-cols-[1fr_120px_140px_100px]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-text group-hover:text-accent">
                      {doc.filename}
                    </span>
                    <span className="block font-mono text-[11px] text-faint sm:hidden">
                      {doc.status === 'FAILED' ? t('statusFailed') : new Date(doc.created_at).toLocaleDateString()}
                    </span>
                  </span>
                  <span className="hidden truncate font-mono text-xs text-muted sm:block">
                    {doc.mime.split('/').pop() ?? '—'}
                  </span>
                  <span>
                    <StatusPill
                      tone={statusTone(doc.status)}
                      label={t(`status${doc.status}`)}
                      pulse={doc.status === 'PROCESSING' || doc.status === 'QUEUED'}
                    />
                  </span>
                  <span className="hidden justify-end sm:flex">
                    <ArrowRight className="size-4 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageBody>
  )
}
