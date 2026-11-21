'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Trash2 } from 'lucide-react'
import type { Agent, WorkflowNode } from '@/lib/workflow-types'
export default function NodeInspector({ node, agents, onChange, onDelete, onJsonError }: { node: WorkflowNode; agents: Agent[]; onChange: (config: Record<string, unknown>) => void; onDelete: () => void; onJsonError: (error: boolean) => void }) {
  const t = useTranslations('workflows'), c = useTranslations('common')
  const [args, setArgs] = useState(JSON.stringify(node.config.arguments ?? {}, null, 2)), [invalid, setInvalid] = useState(false)
  function field(key: string, value: unknown) { onChange({ ...node.config, [key]: value }) }
  const text = (key: string, multiline = false) => <label className="studio-field" key={key}>{t(`fields.${key}`)}{multiline ? <textarea rows={5} data-testid={`config-${key}`} value={String(node.config[key] ?? '')} onChange={e => field(key, e.target.value)} /> : <input data-testid={`config-${key}`} value={String(node.config[key] ?? '')} onChange={e => field(key, e.target.value)} />}</label>
  return <aside className="node-inspector" data-testid="node-inspector"><div className="flex items-center justify-between gap-3"><div><p className="eyebrow">{t('inspector')}</p><h2 className="display text-2xl">{t(`kinds.${node.type}`)}</h2></div><button onClick={onDelete} aria-label={t('deleteNode')} data-testid="delete-node" className="studio-icon"><Trash2 size={16} /></button></div><p className="my-3 break-all font-mono text-xs text-muted" dir="ltr">{node.id}</p>
    <div className="space-y-4">
      {node.type === 'llm' && <><label className="studio-field">{t('fields.agent_id')}<select data-testid="config-agent_id" value={String(node.config.agent_id ?? '')} onChange={e => { const config = { ...node.config }; if (e.target.value) config.agent_id = e.target.value; else delete config.agent_id; onChange(config) }}><option value="">{t('defaultAgent')}</option>{agents.map(a => <option key={a.id} value={a.id}>{a.name} · {a.model}</option>)}</select></label>{text('prompt', true)}</>}
      {node.type === 'retrieve' && <>{text('query', true)}<label className="studio-field">{t('fields.limit')}<input type="number" min={1} max={20} value={Number(node.config.limit ?? 5)} onChange={e => field('limit', Number(e.target.value))} /></label></>}
      {node.type === 'tool' && <><label className="studio-field">{t('fields.name')}<select data-testid="config-name" value={String(node.config.name ?? 'search_docs')} onChange={e => {
        const arguments_ = e.target.value === 'search_docs' ? { query: '{{input}}', limit: 5 } : { document_id: '{{input}}' }
        setArgs(JSON.stringify(arguments_, null, 2)); setInvalid(false); onJsonError(false); onChange({ name: e.target.value, arguments: arguments_ })
      }}><option value="search_docs">search_docs</option><option value="get_document">get_document</option></select></label><label className="studio-field">{t('fields.arguments')}<textarea data-testid="config-arguments" dir="ltr" rows={8} value={args} aria-invalid={invalid} onChange={e => { setArgs(e.target.value); try { const parsed = JSON.parse(e.target.value); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(); setInvalid(false); onJsonError(false); field('arguments', parsed) } catch { setInvalid(true); onJsonError(true) } }} />{invalid && <small role="alert" className="text-warm">{t('invalidJson')}</small>}</label></>}
      {node.type === 'condition' && text('contains')}
      {node.type === 'approval' && text('message', true)}
      {['start', 'end'].includes(node.type) && <p className="text-sm text-muted">{t(node.type === 'start' ? 'startHint' : 'endHint')}</p>}
      {!['start', 'end'].includes(node.type) && <p className="text-xs text-muted">{t('templateHint', { input: '{{input}}', previous: '{{previous}}' })}</p>}
      <p className="text-xs text-warm">{t('noSecrets')}</p><button className="text-xs underline" onClick={() => { onJsonError(false); setInvalid(false); setArgs(JSON.stringify(node.config.arguments ?? {}, null, 2)) }}>{invalid ? c('cancel') : ''}</button>
    </div>
  </aside>
}
