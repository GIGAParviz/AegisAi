'use client'

import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  FileStack,
  MessageSquare,
  RefreshCw,
  Search,
  Server,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageBody } from '@/components/layout/WorkspaceShell'
import { Skeleton, SkeletonList } from '@/components/ui/Skeleton'
import { StatusPill } from '@/components/ui/StatusPill'
import { useHealth } from '@/hooks/useHealth'
import { Link } from '@/lib/navigation'
import { refreshPending, useDocuments } from '@/hooks/useDocuments'
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

function statCard(
  icon: React.ElementType,
  label: string,
  value: number,
  tone: 'accent' | 'ok' | 'warn' | 'danger',
) {
  const wrap = {
    accent: 'bg-accent/10 text-accent',
    ok: 'bg-[#e9efdd] text-[#4c5a3a]',
    warn: 'bg-[#f4ecd8] text-[#7a5f22]',
    danger: 'bg-[#f3e2e8] text-warm',
  }[tone]
  const Icon = icon
  return (
    <div className="card-paper flex items-center gap-4 p-5">
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${wrap}`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="display text-[28px] leading-none">{value}</p>
        <p className="mt-1 truncate text-[13px] text-muted">{label}</p>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const t = useTranslations('dashboard')
  const td = useTranslations('documents')
  const tc = useTranslations('common')
  const { documents } = useDocuments()
  const { health, loading: healthLoading, refresh } = useHealth()
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    refreshPending()
  }, [])

  const onManualRefresh = async () => {
    setRefreshing(true)
    await Promise.all([refresh(), refreshPending()])
    setRefreshing(false)
  }

  const counts = {
    total: documents.length,
    ready: documents.filter((d) => d.status === 'READY').length,
    active: documents.filter((d) => d.status === 'PROCESSING' || d.status === 'QUEUED').length,
    failed: documents.filter((d) => d.status === 'FAILED').length,
  }

  const uptime = health?.system.UpTime
  const uptimeLabel =
    uptime != null
      ? `${Math.floor(uptime / 3600)}${t('hoursShort')} ${Math.floor((uptime % 3600) / 60)}${t('minutesShort')}`
      : '—'

  return (
    <PageBody className="fade-up">
      <PageHeader
        kicker="Dashboard"
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <>
            <Button variant="outline" onClick={onManualRefresh} loading={refreshing}>
              <RefreshCw className="size-4" />
              {tc('refresh')}
            </Button>
            <Link href="/app/documents">
              <Button>
                <FileStack className="size-4" />
                {t('uploadFirst')}
              </Button>
            </Link>
          </>
        }
      />

      {/* Stat cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCard(FileStack, t('docs'), counts.total, 'accent')}
        {statCard(CheckCircle2, t('ready'), counts.ready, 'ok')}
        {statCard(Activity, t('processing'), counts.active, 'warn')}
        {statCard(AlertCircle, t('failed'), counts.failed, 'danger')}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Recent documents */}
        <section className="card-paper p-6 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('recentDocs')}</h2>
            <Link
              href="/app/documents"
              className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
            >
              {td('title')}
              <ArrowRight className="size-3.5 rtl:rotate-180" />
            </Link>
          </div>

          {counts.total === 0 ? (
            <div className="py-10 text-center">
              <FileStack className="mx-auto mb-3 size-10 text-faint" />
              <p className="font-medium">{t('noDocs')}</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted">{t('noDocsHint')}</p>
              <Link href="/app/documents" className="mt-4 inline-block">
                <Button variant="secondary">
                  <FileStack className="size-4" />
                  {t('uploadFirst')}
                </Button>
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {documents.slice(0, 5).map((doc) => (
                <li key={doc.id}>
                  <Link
                    href={`/app/documents/${doc.id}`}
                    className="group flex items-center gap-4 py-3 transition-colors"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-paper text-muted">
                      <FileStack className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-text group-hover:text-accent">
                        {doc.filename}
                      </span>
                      <span className="block font-mono text-[11px] text-faint">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </span>
                    </span>
                    <StatusPill tone={statusTone(doc.status)} label={td(`status${doc.status}`)} pulse={doc.status === 'PROCESSING'} />
                    <ArrowRight className="size-4 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* System health */}
        <section className="card-paper flex flex-col p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('systemHealth')}</h2>
            {healthLoading ? (
              <Skeleton className="h-5 w-16 rounded-full" />
            ) : health ? (
              <StatusPill tone="ok" label={t('apiHealthy')} />
            ) : (
              <StatusPill tone="danger" label={t('apiDown')} />
            )}
          </div>

          {healthLoading ? (
            <SkeletonList rows={3} />
          ) : health ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="card-panel p-4">
                  <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-faint">
                    <Cpu className="size-3.5" /> {t('cpu')}
                  </p>
                  <p className="display mt-1.5 text-[26px] leading-none">
                    {health.system['CPU Percent'].toFixed(1)}%
                  </p>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-accent transition-[width] duration-700"
                      style={{ width: `${Math.min(100, health.system['CPU Percent'])}%` }}
                    />
                  </div>
                </div>
                <div className="card-panel p-4">
                  <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-faint">
                    <Database className="size-3.5" /> {t('memory')}
                  </p>
                  <p className="display mt-1.5 text-[26px] leading-none">
                    {health.system['Memory Percent'].toFixed(1)}%
                  </p>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-warm/70 transition-[width] duration-700"
                      style={{ width: `${Math.min(100, health.system['Memory Percent'])}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-xl border border-line bg-paper px-4 py-3">
                <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-faint">
                  <Clock className="size-3.5" /> {t('uptime')}
                </p>
                <p className="text-sm font-medium">{uptimeLabel}</p>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
              <Server className="mb-3 size-10 text-faint" />
              <p className="text-sm font-medium">{t('apiDown')}</p>
              <p className="mt-1 max-w-[26ch] text-xs text-muted">{t('apiDownHint')}</p>
            </div>
          )}
        </section>
      </div>

      {/* Quick actions */}
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <Link href="/app/chat" className="card-paper group flex items-center gap-4 p-5 transition-shadow hover:shadow-lift">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
            <MessageSquare className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{t('qaChat')}</span>
            <Badge variant="success" className="mt-1">{tc('live')}</Badge>
          </span>
          <ArrowRight className="size-4 text-faint transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
        </Link>
        <Link href="/app/search" className="card-paper group flex items-center gap-4 p-5 transition-shadow hover:shadow-lift">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#4c767c]/10 text-[#4c767c]">
            <Search className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{t('qaSearch')}</span>
            <Badge variant="neutral" className="mt-1">{tc('comingSoon')}</Badge>
          </span>
          <ArrowRight className="size-4 text-faint transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
        </Link>
        <Link href="/app/system" className="card-paper group flex items-center gap-4 p-5 transition-shadow hover:shadow-lift">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#f4ecd8] text-[#7a5f22]">
            <Server className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{t('qaSystem')}</span>
            <Badge variant="success" className="mt-1">{tc('live')}</Badge>
          </span>
          <ArrowRight className="size-4 text-faint transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
        </Link>
      </section>
    </PageBody>
  )
}
