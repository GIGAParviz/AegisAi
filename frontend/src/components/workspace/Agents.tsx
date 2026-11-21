'use client'
import { useCallback, useEffect, useState } from 'react'
import { Bot, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { PageBody } from '@/components/layout/WorkspaceShell'
import { Button } from '@/components/ui/Button'
import { errorMessage, workspaceApi } from '@/lib/workspace-api'
import type { Agent, AgentInput } from '@/lib/workflow-types'
const blank: AgentInput = { name: '', model: '', system_prompt: '', allowed_tools: [], requires_approval: false }
export default function Agents() {
  const t = useTranslations('agents'), c = useTranslations('common')
  const [agents, setAgents] = useState<Agent[]>([]), [selected, setSelected] = useState<string | null>(null)
  const [draft, setDraft] = useState<AgentInput | null>(null), [tools, setTools] = useState('')
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [saved, setSaved] = useState(false)
  const load = useCallback(async () => { setLoading(true); try { setAgents(await workspaceApi.agents()); setError('') } catch (e) { setError(await errorMessage(e)) } finally { setLoading(false) } }, [])
  useEffect(() => {
    let active = true
    workspaceApi.agents().then(value => { if (active) setAgents(value) }).catch(async e => { const message = await errorMessage(e); if (active) setError(message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  function edit(agent?: Agent) { setSelected(agent?.id ?? null); setDraft(agent ? { name: agent.name, model: agent.model, system_prompt: agent.system_prompt, allowed_tools: agent.allowed_tools, requires_approval: agent.requires_approval } : { ...blank }); setTools(agent?.allowed_tools.join(', ') ?? ''); setSaved(false); setError('') }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!draft || busy) return
    setBusy(true); setError(''); setSaved(false)
    try {
      const agent = await workspaceApi.saveAgent(selected, { ...draft, name: draft.name.trim(), model: draft.model.trim(), allowed_tools: tools.split(',').map(s => s.trim()).filter(Boolean) })
      setAgents(prev => [agent, ...prev.filter(a => a.id !== agent.id)]); setSelected(agent.id); setSaved(true)
    } catch (e) { setError(await errorMessage(e)) } finally { setBusy(false) }
  }
  async function remove() {
    if (!selected || !window.confirm(t('confirmDelete'))) return
    setBusy(true); setError('')
    try { setAgents(await workspaceApi.deleteAgent(selected)); setDraft(null); setSelected(null) } catch (e) { setError(await errorMessage(e)) } finally { setBusy(false) }
  }
  return <PageBody>
    <div className="studio-heading"><div><p className="eyebrow">Aegis / {t('registry')}</p><h1 className="display text-4xl">{t('title')}</h1><p className="mt-3 text-muted">{t('subtitle')}</p></div><Button data-testid="new-agent" disabled={busy} onClick={() => edit()}><Plus size={16} />{t('new')}</Button></div>
    {error && <div className="studio-error" role="alert">{error} <button onClick={load}>{c('retry')}</button></div>}
    <div className="grid gap-6 lg:grid-cols-[minmax(240px,1fr)_minmax(300px,1.4fr)]">
      <section className="space-y-3" aria-label={t('title')}>
        {loading ? <p role="status">{c('loading')}</p> : agents.length === 0 ? <div className="studio-empty"><Bot size={32} /><h2>{t('empty')}</h2><p>{t('emptyHint')}</p></div> : agents.map(agent => <button key={agent.id} disabled={busy} onClick={() => edit(agent)} className={`agent-card ${selected === agent.id ? 'selected' : ''}`}><span className="studio-icon"><Bot size={20} /></span><span className="min-w-0 flex-1"><strong className="block truncate">{agent.name}</strong><span className="text-sm text-muted">{agent.model}</span></span>{agent.requires_approval && <ShieldCheck size={18} />}</button>)}
      </section>
      {draft ? <form onSubmit={save} className="studio-panel" onChange={() => setSaved(false)}>
        <fieldset disabled={busy} className="min-w-0 space-y-5">
        <div className="flex justify-between gap-3"><h2 className="display text-2xl">{selected ? t('edit') : t('new')}</h2>{selected && <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={remove} aria-label={c('delete')}><Trash2 size={16} /></Button>}</div>
        <label className="studio-field">{t('name')}<input required maxLength={120} data-testid="agent-name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
        <label className="studio-field">{t('model')}<input required data-testid="agent-model" dir="ltr" value={draft.model} onChange={e => setDraft({ ...draft, model: e.target.value })} /><small>{t('modelHint')}</small></label>
        <label className="studio-field">{t('prompt')}<textarea required rows={7} data-testid="agent-prompt" value={draft.system_prompt} onChange={e => setDraft({ ...draft, system_prompt: e.target.value })} /></label>
        <label className="studio-field">{t('tools')}<input dir="ltr" value={tools} onChange={e => setTools(e.target.value)} /><small>{t('toolsHint')}</small></label>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={draft.requires_approval} onChange={e => setDraft({ ...draft, requires_approval: e.target.checked })} />{t('approval')}</label>
        <p className="text-xs text-muted">{t('secrets')}</p>
        <div className="flex items-center gap-3"><Button data-testid="save-agent" loading={busy} type="submit">{c('save')}</Button>{saved && <span role="status" className="text-sm text-accent">{t('saved')}</span>}</div>
        </fieldset>
      </form> : <div className="studio-panel grid min-h-80 place-content-center text-center"><Bot className="mx-auto mb-4 text-accent" size={40} /><p className="display text-2xl">{t('choose')}</p></div>}
    </div>
  </PageBody>
}
