'use client'
import { useEffect, useState } from 'react'
import { ArrowLeft, Plus, Save, Play } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/lib/navigation'
import { Button } from '@/components/ui/Button'
import { defaultConfig, initialGraph, removeNode, validateGraph } from '@/lib/graph'
import { workspaceApi, errorMessage } from '@/lib/workspace-api'
import { nodeKinds, type Agent, type Graph, type NodeKind, type WorkflowRun } from '@/lib/workflow-types'
import GraphCanvas from './GraphCanvas'
import NodeInspector from './NodeInspector'
import RunHistory from './RunHistory'
export default function WorkflowEditor({ workflowId }: { workflowId: string | null }) {
  const t = useTranslations('workflows'), c = useTranslations('common'), router = useRouter()
  const [id, setId] = useState(workflowId), [name, setName] = useState(''), [description, setDescription] = useState('')
  const [graph, setGraph] = useState<Graph>(initialGraph), [selected, setSelected] = useState<string | null>(null), [agents, setAgents] = useState<Agent[]>([])
  const [dirty, setDirty] = useState(!workflowId), [busy, setBusy] = useState(false), [loading, setLoading] = useState(!!workflowId), [error, setError] = useState(''), [agentError, setAgentError] = useState(''), [validation, setValidation] = useState<string[]>([]), [jsonError, setJsonError] = useState(false)
  const [input, setInput] = useState(''), [run, setRun] = useState<WorkflowRun | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const locked = loading || busy || loadFailed
  useEffect(() => { let active = true; workspaceApi.agents().then(a => { if (active) setAgents(a) }).catch(async e => { const message = await errorMessage(e); if (active) setAgentError(message) }); return () => { active = false } }, [])
  useEffect(() => { if (!workflowId) return; let active = true; workspaceApi.workflow(workflowId).then(w => { if (active) { setId(w.id); setName(w.name); setDescription(w.description); setGraph({ nodes: w.nodes, edges: w.edges }); setDirty(false); setLoading(false) } }).catch(async e => { const message = await errorMessage(e); if (active) { setError(message); setLoadFailed(true); setLoading(false) } }); return () => { active = false } }, [workflowId])
  useEffect(() => { if (!dirty) return; function leave(e: BeforeUnloadEvent) { e.preventDefault() } window.addEventListener('beforeunload', leave); return () => window.removeEventListener('beforeunload', leave) }, [dirty])
  function change(next: Graph) { if (locked) return; setGraph(next); setDirty(true); setValidation([]) }
  function add(kind: NodeKind) { if (locked) return; if (jsonError) { setError(t('invalidJson')); return } const nodeId = `${kind}-${crypto.randomUUID().slice(0, 8)}`; change({ ...graph, nodes: [...graph.nodes, { id: nodeId, type: kind, position: { x: 180 + graph.nodes.length * 35, y: 80 + graph.nodes.length * 45 }, config: defaultConfig(kind) }] }); setSelected(nodeId); setJsonError(false) }
  async function save() {
    if (locked) return
    const errors = validateGraph(graph); if (!name.trim()) errors.push('name'); if (jsonError) errors.push('json'); setValidation(errors); if (errors.length) return
    setBusy(true); setError('')
    try { const saved = await workspaceApi.saveWorkflow(id, { name: name.trim(), description, ...graph }); setId(saved.id); setGraph({ nodes: saved.nodes, edges: saved.edges }); setDirty(false); if (!id) router.replace(`/app/workflows/${saved.id}`) } catch (e) { setError(await errorMessage(e)) } finally { setBusy(false) }
  }
  async function execute() { if (!id || dirty || locked || jsonError) return; setBusy(true); setError(''); try { setRun(await workspaceApi.startRun(id, input)) } catch (e) { setError(await errorMessage(e)) } finally { setBusy(false) } }
  const node = graph.nodes.find(n => n.id === selected)
  return <div className="workflow-editor overflow-y-auto">
    <div className="builder-header"><div className="flex min-w-0 items-center gap-4"><Link href="/app/workflows" aria-label={c('back')} className="studio-icon"><ArrowLeft size={18} className="rtl:rotate-180" /></Link><div className="min-w-0"><p className="eyebrow">{t('studio')}</p><h1 className="display text-2xl">{name || t('untitled')}</h1></div></div><div className="flex items-center gap-3"><span className="hidden text-xs text-muted sm:block" role="status">{dirty ? t('unsaved') : id && !loading && !loadFailed ? t('saved') : ''}</span><Button size="sm" data-testid="save-workflow" onClick={save} loading={busy} disabled={locked}><Save size={16} />{c('save')}</Button></div></div>
    {loading && <p className="p-4" role="status">{c('loading')}</p>}{error && <div className="studio-error mx-4" role="alert">{error}</div>}{validation.length > 0 && <div className="studio-error mx-4" role="alert"><ul>{validation.map(v => <li key={v}>{t(`validation.${v}`)}</li>)}</ul></div>}
    <fieldset disabled={locked} className="contents">
    <div className="builder-meta"><label className="studio-field">{t('name')}<input data-testid="workflow-name" value={name} maxLength={120} onChange={e => { setName(e.target.value); setDirty(true) }} /></label><label className="studio-field">{t('description')}<input data-testid="workflow-description" value={description} maxLength={4000} onChange={e => { setDescription(e.target.value); setDirty(true) }} /></label></div>
    <div className="node-palette" aria-label={t('addNode')}>{nodeKinds.map(kind => <button key={kind} data-testid={`add-node-${kind}`} aria-label={`${t('addNode')} ${t(`kinds.${kind}`)}`} onClick={() => add(kind)} disabled={loading || busy}><Plus size={13} />{t(`kinds.${kind}`)}</button>)}</div>
    <div className="builder-workarea"><GraphCanvas graph={graph} onChange={change} selectedId={selected} editable={!locked} onSelect={nodeId => { if (jsonError && selected !== nodeId) { setError(t('invalidJson')); return } setSelected(nodeId) }} run={run} />{node ? <NodeInspector key={node.id} node={node} agents={agents} onJsonError={invalid => { setJsonError(invalid); if (invalid) setDirty(true) }} onDelete={() => { change(removeNode(graph, node.id)); setSelected(null); setJsonError(false) }} onChange={config => change({ ...graph, nodes: graph.nodes.map(n => n.id === node.id ? { ...n, config } : n) })} /> : <aside className="node-inspector inspector-empty"><p className="eyebrow">{t('inspector')}</p><h2 className="display text-2xl">{t('selectNode')}</h2><p className="mt-3 text-sm text-muted">{t('inspectorHint')}</p></aside>}</div>
    </fieldset>
    {agentError && <p role="alert" className="studio-error mx-4">{t('agentsUnavailable')}: {agentError}</p>}
    <section className="run-console"><div className="flex flex-wrap items-end gap-4"><label className="studio-field min-w-48 flex-1">{t('runInput')}<textarea rows={2} maxLength={16000} data-testid="run-input" value={input} onChange={e => setInput(e.target.value)} placeholder={t('runPlaceholder')} /></label><Button data-testid="run-workflow" onClick={execute} loading={busy} disabled={!id || dirty || locked || jsonError}><Play size={16} />{t('run')}</Button></div><p className="mt-2 text-xs text-muted">{dirty || !id ? t('saveBeforeRun') : t('runHint')}</p></section>
    {id && <RunHistory workflowId={id} selected={run} onSelect={setRun} />}
  </div>
}
