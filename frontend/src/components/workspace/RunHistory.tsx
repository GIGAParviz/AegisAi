'use client'
import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, RefreshCw, X } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { errorMessage, workspaceApi } from '@/lib/workspace-api'
import type { WorkflowRun } from '@/lib/workflow-types'
import { Button } from '@/components/ui/Button'
export function RunResult({ run, onChange }: { run: WorkflowRun; onChange: (run: WorkflowRun) => void }) {
  const t = useTranslations('workflows'), { user } = useAuthStore()
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function decide(decision: 'approve' | 'reject') { setBusy(true); setError(''); try { onChange(await workspaceApi.decide(run.id, decision)) } catch (e) { setError(await errorMessage(e)) } finally { setBusy(false) } }
  return <div className="run-detail" data-testid={`run-result-${run.id}`}><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">{t('runDetail')}</h3><span className={`run-status ${run.status}`}>{t(`statuses.${run.status}`)}</span></div><p className="my-2 break-all font-mono text-[10px] text-muted" dir="ltr">{run.id}</p>
    <details className="mb-3 text-sm"><summary>{t('runInput')}</summary><pre className="result-output">{run.input}</pre></details>
    {run.status === 'awaiting_approval' && <div className="approval-request"><p className="text-sm">{t('pendingNode')}: <b dir="ltr">{run.pending_node_id}</b></p>{user?.role?.toUpperCase() === 'ADMIN' ? <div className="mt-3 flex gap-2"><Button size="sm" data-testid="approve-run" disabled={busy} onClick={() => decide('approve')}><Check size={15} />{t('approve')}</Button><Button variant="danger" size="sm" data-testid="reject-run" disabled={busy} onClick={() => decide('reject')}><X size={15} />{t('reject')}</Button></div> : <p className="mt-2 text-xs text-muted">{t('adminRequired')}</p>}</div>}
    {error && <p className="studio-error" role="alert">{error}</p>}{run.error && <p role="alert" className="studio-error">{run.error}</p>}
    <ol className="node-results">{run.node_results.map((result, index) => <li key={`${result.node_id}-${index}`} data-testid={`result-${result.node_id}`}><div className="flex flex-wrap justify-between gap-2"><strong className="font-mono text-xs">{result.node_id}</strong><span className="text-xs text-muted">{t.has(`statuses.${result.status}`) ? t(`statuses.${result.status}`) : result.status}</span></div>{result.output !== null && result.output !== undefined && <pre className="result-output">{typeof result.output === 'string' ? result.output : JSON.stringify(result.output, null, 2)}</pre>}{result.error && <p className="mt-2 text-sm text-warm">{result.error}</p>}</li>)}</ol>
    {run.output !== null && <div className="mt-4"><h4 className="eyebrow">{t('output')}</h4><pre className="result-output">{run.output}</pre></div>}
  </div>
}
export default function RunHistory({ workflowId, selected, onSelect, pendingOnly = false }: { workflowId?: string; selected: WorkflowRun | null; onSelect: (run: WorkflowRun) => void; pendingOnly?: boolean }) {
  const t = useTranslations('workflows'), c = useTranslations('common'), locale = useLocale()
  const [runs, setRuns] = useState<WorkflowRun[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('')
  const refresh = useCallback(async () => { try { setRuns(await workspaceApi.runs()); setError('') } catch (e) { setError(await errorMessage(e)) } finally { setLoading(false) } }, [])
  useEffect(() => {
    let active = true
    workspaceApi.runs().then(value => { if (active) setRuns(value) }).catch(async e => { const message = await errorMessage(e); if (active) setError(message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [selected?.id])
  useEffect(() => { if (!selected || !['running', 'awaiting_approval'].includes(selected.status)) return; const timer = setInterval(() => { void workspaceApi.run(selected.id).then(onSelect).catch(async e => setError(await errorMessage(e))) }, 2000); return () => clearInterval(timer) }, [selected, onSelect])
  const all = selected ? [selected, ...runs.filter(r => r.id !== selected.id)] : runs
  const visible = all.filter(r => (!workflowId || r.workflow_id === workflowId) && (!pendingOnly || r.status === 'awaiting_approval')).sort((a, b) => b.created_at.localeCompare(a.created_at))
  async function open(id: string) { try { onSelect(await workspaceApi.run(id)); setError('') } catch (e) { setError(await errorMessage(e)) } }
  return <section className="run-history"><div className="mb-4 flex items-center justify-between gap-4"><h2 className="display text-2xl">{pendingOnly ? t('pendingApprovals') : t('history')}</h2><button className="studio-icon" aria-label={c('refresh')} onClick={refresh}><RefreshCw size={15} /></button></div>{error && <p className="studio-error" role="alert">{error}</p>}
    <div className="grid gap-5 xl:grid-cols-[240px_1fr]"><div>{loading && <p role="status" className="text-sm text-muted">{c('loading')}</p>}{!loading && !visible.length && <p className="py-4 text-sm text-muted">{t('noRuns')}</p>}<div className="max-h-96 space-y-2 overflow-y-auto">{visible.map(run => <button key={run.id} data-testid={`open-run-${run.id}`} onClick={() => open(run.id)} className={`run-list-item ${selected?.id === run.id ? 'selected' : ''}`}><span className={`run-status ${run.status}`}>{t(`statuses.${run.status}`)}</span><time className="mt-2 block text-xs text-muted">{run.created_at ? new Date(run.created_at).toLocaleString(locale) : '—'}</time><span className="mt-1 block truncate text-xs">{run.input}</span><span className="block truncate font-mono text-[10px] text-faint">{run.id}</span></button>)}</div></div>{selected ? <RunResult key={selected.id} run={selected} onChange={onSelect} /> : <div className="studio-empty"><p>{t('selectRun')}</p></div>}</div>
  </section>
}
