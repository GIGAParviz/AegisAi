'use client'
import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { GitBranch, Plus, Trash2, ArrowUpRight, RefreshCw } from 'lucide-react'
import { PageBody } from '@/components/layout/WorkspaceShell'
import { Button } from '@/components/ui/Button'
import { Link } from '@/lib/navigation'
import { workspaceApi, errorMessage } from '@/lib/workspace-api'
import type { Workflow } from '@/lib/workflow-types'
export default function Workflows() {
  const t = useTranslations('workflows'), c = useTranslations('common'), locale = useLocale()
  const [workflows, setWorkflows] = useState<Workflow[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState<string | null>(null)
  const load = useCallback(async () => { setLoading(true); try { setWorkflows(await workspaceApi.workflows()); setError('') } catch (e) { setError(await errorMessage(e)) } finally { setLoading(false) } }, [])
  useEffect(() => {
    let active = true
    workspaceApi.workflows().then(value => { if (active) setWorkflows(value) }).catch(async e => { const message = await errorMessage(e); if (active) setError(message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  async function remove(id: string) { if (!window.confirm(t('confirmDelete'))) return; setBusy(id); try { setWorkflows(await workspaceApi.deleteWorkflow(id)); setError('') } catch (e) { setError(await errorMessage(e)) } finally { setBusy(null) } }
  return <PageBody><div className="studio-heading"><div><p className="eyebrow">Aegis / {t('studio')}</p><h1 className="display text-4xl">{t('title')}</h1><p className="mt-3 max-w-xl text-muted">{t('subtitle')}</p></div><div className="flex items-center gap-2"><Button variant="ghost" aria-label={c('refresh')} onClick={load}><RefreshCw size={16} /></Button><Link href="/app/workflows/new" className="studio-primary" data-testid="new-workflow"><Plus size={16} />{t('new')}</Link></div></div>
    {error && <p className="studio-error" role="alert">{error}</p>}{loading && <p role="status">{c('loading')}</p>}
    {!loading && !workflows.length && !error && <div className="studio-empty py-20"><GitBranch size={40} /><h2 className="display text-3xl">{t('empty')}</h2><p>{t('emptyHint')}</p><Link href="/app/workflows/new" className="studio-primary mt-5">{t('new')}</Link></div>}
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{workflows.map(w => <article key={w.id} className="workflow-card"><div className="flex items-center justify-between"><span className="studio-icon"><GitBranch size={21} /></span><button disabled={busy === w.id} aria-label={`${c('delete')} ${w.name}`} className="studio-icon" onClick={() => remove(w.id)}><Trash2 size={15} /></button></div><Link href={`/app/workflows/${w.id}`} className="mt-5 block"><h2 className="display text-2xl break-words">{w.name}</h2><p className="mt-3 line-clamp-2 min-h-12 text-sm text-muted">{w.description || t('noDescription')}</p><div className="mt-6 flex items-center justify-between border-t border-line pt-4"><span className="font-mono text-xs text-muted">{t('nodeCount', { count: w.nodes.length })}</span><ArrowUpRight size={18} className="text-accent" /></div></Link><time className="mt-2 block text-[10px] text-faint">{new Date(w.created_at).toLocaleDateString(locale)}</time></article>)}</div>
  </PageBody>
}
