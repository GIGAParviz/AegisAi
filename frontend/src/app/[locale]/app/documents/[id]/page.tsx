'use client'

import { useTranslations } from 'next-intl'
import { clsx } from 'clsx'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileStack,
  MessageSquare,
  TriangleAlert,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageBody } from '@/components/layout/WorkspaceShell'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusPill } from '@/components/ui/StatusPill'
import { refreshDocument, useDocuments } from '@/hooks/useDocuments'
import { Link } from '@/lib/navigation'
import type { Document } from '@/lib/types'

const steps = ['queued', 'processing', 'ready'] as const

export default function DocumentDetailPage() {
  const t = useTranslations('documents')
  const { documents } = useDocuments()
  const params = useParams<{ id: string }>()
  const id = params.id
  const doc = documents.find((d) => d.id === id) ?? null

  const [serverDoc, setServerDoc] = useState<Document | null>(null)
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    if (!id) return
    let alive = true
    refreshDocument(id)
      .then((d) => alive && setServerDoc(d))
      .catch(() => alive && setFetchError(true))
    return () => {
      alive = false
    }
  }, [id])

  const data = serverDoc ?? doc
  const activeStep =
    data?.status === 'READY'
      ? 2
      : data?.status === 'PROCESSING'
        ? 1
        : data?.status === 'QUEUED'
          ? 0
          : data?.status === 'FAILED'
            ? 1
            : 0

  return (
    <PageBody className="fade-up">
      <Link
        href="/app/documents"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t('backToList')}
      </Link>

      {!data ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <>
          <PageHeader
            kicker={t('title')}
            title={data.filename}
            actions={
              <StatusPill
                tone={
                  data.status === 'READY'
                    ? 'ok'
                    : data.status === 'FAILED'
                      ? 'danger'
                      : 'warn'
                }
                label={t(`status${data.status}`)}
                pulse={data.status === 'PROCESSING' || data.status === 'QUEUED'}
              />
            }
          />

          {fetchError && (
            <div role="alert" className="mt-4 flex items-center gap-2 rounded-xl border border-warm/30 bg-[#f3e2e8] px-4 py-3 text-sm text-warm">
              <TriangleAlert className="size-4 shrink-0" />
              {t('notFound')}
            </div>
          )}

          {/* Pipeline stepper */}
          <section className="card-paper mt-8 p-6">
            <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-faint">
              {t('pipeline')}
            </h2>
            <ol className="flex items-start gap-2">
              {steps.map((step, i) => {
                const isCurrent = i === activeStep && data.status !== 'READY'
                const isDone = i < activeStep || data.status === 'READY'
                const isFailed = step === 'processing' && data.status === 'FAILED'
                return (
                  <li key={step} className="flex flex-1 flex-col items-center gap-2 text-center">
                    <span
                      className={clsx(
                        'grid size-8 place-items-center rounded-full border-2 transition-colors',
                        isDone
                          ? 'border-[#68734b] bg-[#68734b] text-paper'
                          : isFailed
                            ? 'border-warm bg-warm text-paper'
                            : isCurrent
                              ? 'border-warn bg-[#f4ecd8] text-[#7a5f22]'
                              : 'border-line bg-paper text-faint',
                      )}
                    >
                      {isDone ? (
                        <CheckCircle2 className="size-4" />
                      ) : isFailed ? (
                        <TriangleAlert className="size-4" />
                      ) : isCurrent ? (
                        <Clock className="size-4 animate-spin" style={{ animationDuration: '3s' }} />
                      ) : (
                        <span className="font-mono text-xs">{i + 1}</span>
                      )}
                    </span>
                    <span className={clsx('text-[13px] leading-tight', isCurrent || isDone ? 'font-medium text-text' : 'text-muted')}>
                      {t(`pipeline${step.charAt(0).toUpperCase()}${step.slice(1)}` as `pipeline${string}`)}
                    </span>
                  </li>
                )
              })}
            </ol>
            <p className="prose-serif mt-4 text-center text-sm text-muted">
              {data.status === 'READY'
                ? t('pipelineReady')
                : data.status === 'FAILED'
                  ? `${t('error')}: ${data.error ?? '—'}`
                  : data.status === 'PROCESSING'
                    ? t('processingDesc') ?? t('pipelineProcessing')
                    : t('pipelineProcessing')}
            </p>
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-5">
            {/* Metadata */}
            <section className="card-paper p-6 lg:col-span-3">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-faint">
                {t('metadata')}
              </h2>
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {[
                  { label: t('documentId'), value: data.id, mono: true },
                  { label: t('mimeType'), value: data.mime, mono: true },
                  { label: t('ownerId'), value: data.owner_id, mono: true },
                  { label: t('created'), value: new Date(data.created_at).toLocaleString() },
                ].map((row) => (
                  <div key={row.label}>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-faint">
                      {row.label}
                    </dt>
                    <dd
                      className={clsx(
                        'mt-1 break-all text-sm text-muted',
                        row.mono && 'font-mono text-xs',
                      )}
                    >
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* Actions */}
            <section className="card-paper flex flex-col gap-3 p-6 lg:col-span-2">
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-faint">
                {t('actions')}
              </h2>
              <Link href={`/app/chat?doc=${data.id}`}>
                <Button className="w-full" disabled={data.status !== 'READY'}>
                  <MessageSquare className="size-4" />
                  {t('chatWithDoc')}
                </Button>
              </Link>
              <Link href="/app/search">
                <Button variant="secondary" className="w-full">
                  <FileStack className="size-4" />
                  {t('searchInDoc')}
                </Button>
              </Link>
              <p className="mt-auto pt-2 font-mono text-[10px] leading-relaxed text-faint">
                chunks · embedding · qdrant upsert → worker status arrives with the ingestion worker
              </p>
            </section>
          </div>
        </>
      )}
    </PageBody>
  )
}
