'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { PageBody } from '@/components/layout/WorkspaceShell'
import type { WorkflowRun } from '@/lib/workflow-types'
import RunHistory from './RunHistory'
export default function Runs({ pendingOnly = false }: { pendingOnly?: boolean }) {
  const t = useTranslations('workflows'), [run, setRun] = useState<WorkflowRun | null>(null)
  return <PageBody><div className="studio-heading"><div><p className="eyebrow">Aegis / {t('execution')}</p><h1 className="display text-4xl">{pendingOnly ? t('pendingApprovals') : t('history')}</h1><p className="mt-3 text-muted">{pendingOnly ? t('approvalHint') : t('historyHint')}</p></div></div><RunHistory selected={run} onSelect={setRun} pendingOnly={pendingOnly} /></PageBody>
}
