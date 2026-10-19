'use client'

import { useTranslations } from 'next-intl'
import { HeartPulse, RefreshCw, Server } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageBody } from '@/components/layout/WorkspaceShell'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusPill } from '@/components/ui/StatusPill'
import { useHealth } from '@/hooks/useHealth'

export default function SystemPage() {
  const t = useTranslations('system')
  const tc = useTranslations('common')
  const { health, loading, refresh } = useHealth()
  const [spin, setSpin] = useState(false)

  const onRefresh = async () => {
    setSpin(true)
    await refresh()
    setSpin(false)
  }

  const services = [
    { name: t('apiServer'), value: health ? t('healthy') : t('unreachable'), up: !!health, live: true },
    { name: t('postgres'), value: t('unreachable'), up: false, live: false },
    { name: t('qdrant'), value: t('unreachable'), up: false, live: false },
    { name: t('redis'), value: t('unreachable'), up: false, live: false },
    { name: t('llmServer'), value: t('unreachable'), up: false, live: false },
    { name: t('langfuse'), value: t('unreachable'), up: false, live: false },
  ]

  return (
    <PageBody className="fade-up">
      <PageHeader
        kicker="Account"
        title={t('title')}
        actions={
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-paper/60 px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-panel hover:text-text"
          >
            <RefreshCw className={`size-4 ${spin ? 'animate-spin' : ''}`} />
            {tc('refresh')}
          </button>
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? [1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-24" />)
          : services.map((svc) => (
              <div key={svc.name} className="card-paper flex items-center gap-4 p-5">
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                    svc.up ? 'bg-[#e9efdd] text-[#4c5a3a]' : 'bg-[#f0efe8] text-faint'
                  }`}
                >
                  <Server className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{svc.name}</p>
                  <div className="mt-1.5">
                    <StatusPill
                      tone={svc.up ? 'ok' : svc.live ? 'danger' : 'muted'}
                      label={svc.up ? svc.value : svc.live ? svc.value : tc('comingSoon')}
                      pulse={svc.up}
                    />
                  </div>
                </div>
              </div>
            ))}
      </div>

      {health && (
        <div className="card-paper mt-6 grid gap-px overflow-hidden bg-line sm:grid-cols-3">
          {[
            { label: t('cpuUsage'), value: `${health.system['CPU Percent'].toFixed(1)}%` },
            { label: t('memoryUsage'), value: `${health.system['Memory Percent'].toFixed(1)}%` },
            {
              label: t('uptime'),
              value: `${Math.floor(health.system.UpTime / 3600)}h ${Math.floor(
                (health.system.UpTime % 3600) / 60,
              )}m`,
            },
          ].map((m) => (
            <div key={m.label} className="bg-paper px-6 py-5">
              <p className="font-mono text-[10px] uppercase tracking-wider text-faint">{m.label}</p>
              <p className="display mt-1.5 text-[26px] leading-none">{m.value}</p>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 flex items-center gap-2 text-xs text-faint">
        <HeartPulse className="size-3.5" />
        Per-service probes (Postgres, Qdrant, Redis…) land with Phase 7 compose healthchecks.
      </p>
    </PageBody>
  )
}
