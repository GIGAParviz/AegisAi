'use client'
import { memo, useMemo, useState } from 'react'
import { ReactFlow, Background, Controls, MiniMap, Handle, Position, applyNodeChanges, applyEdgeChanges, type Node, type NodeProps, type NodeChange, type EdgeChange, type Connection } from '@xyflow/react'
import { Bot, Play, Search, Wrench, GitBranch, ShieldCheck, Flag } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { connectGraph } from '@/lib/graph'
import type { Graph, NodeKind, WorkflowRun } from '@/lib/workflow-types'
import '@xyflow/react/dist/style.css'
const icons = { start: Play, llm: Bot, retrieve: Search, tool: Wrench, condition: GitBranch, approval: ShieldCheck, end: Flag }
type CanvasNode = Node<{ kind: NodeKind; preview: string; status?: string }, 'aegis'>
const GraphNode = memo(function GraphNode({ id, data, selected }: NodeProps<CanvasNode>) {
  const t = useTranslations('workflows'), Icon = icons[data.kind]
  return <div className={`workflow-node kind-${data.kind} ${selected ? 'selected' : ''} ${data.status ? `result-${data.status}` : ''}`} data-testid={`node-${id}`}>
    {data.kind !== 'start' && <Handle type="target" position={Position.Left} aria-label={`${id} input`} data-testid={`handle-${id}-input`} />}
    <div className="flex items-center gap-3"><span className="node-icon"><Icon size={18} /></span><div><p className="font-medium text-sm">{t(`kinds.${data.kind}`)}</p><p className="max-w-32 truncate font-mono text-[10px] text-muted">{id}</p></div></div>
    {data.preview && <p className="mt-3 max-w-44 truncate border-t border-line pt-2 text-xs text-muted">{data.preview}</p>}
    {data.status && <p className="mt-2 text-xs font-medium">{t.has(`statuses.${data.status}`) ? t(`statuses.${data.status}`) : data.status}</p>}
    {data.kind === 'condition' ? <><span className="branch-label true">{t('true')}</span><Handle type="source" id="true" position={Position.Right} style={{ top: '35%' }} aria-label={`${id} true output`} data-testid={`handle-${id}-true`} /><span className="branch-label false">{t('false')}</span><Handle type="source" id="false" position={Position.Right} style={{ top: '75%' }} aria-label={`${id} false output`} data-testid={`handle-${id}-false`} /></> : data.kind !== 'end' && <Handle type="source" position={Position.Right} aria-label={`${id} output`} data-testid={`handle-${id}-output`} />}
  </div>
})
const nodeTypes = { aegis: GraphNode }
export default function GraphCanvas({ graph, onChange, selectedId, onSelect, run, editable = true }: { graph: Graph; onChange: (graph: Graph) => void; selectedId: string | null; onSelect: (id: string | null) => void; run: WorkflowRun | null; editable?: boolean }) {
  const t = useTranslations('workflows')
  const [selectedEdges, setSelectedEdges] = useState<Set<string>>(new Set())
  const nodes = useMemo<CanvasNode[]>(() => graph.nodes.map(n => ({ id: n.id, type: 'aegis', position: n.position, selected: n.id === selectedId, data: { kind: n.type, preview: String(n.config.prompt ?? n.config.query ?? n.config.name ?? n.config.contains ?? n.config.message ?? ''), status: run?.node_results.find(r => r.node_id === n.id)?.status ?? (run?.pending_node_id === n.id ? 'awaiting_approval' : undefined) } })), [graph.nodes, selectedId, run])
  function changeNodes(changes: NodeChange<CanvasNode>[]) {
    if (!editable) return
    const updated = applyNodeChanges(changes, nodes)
    const selected = changes.find(c => c.type === 'select' && c.selected)
    if (selected && 'id' in selected) onSelect(selected.id)
    if (changes.every(c => c.type === 'select' || c.type === 'dimensions')) return
    const ids = new Set(updated.map(n => n.id))
    onChange({ nodes: updated.map(n => ({ ...graph.nodes.find(old => old.id === n.id)!, position: n.position })), edges: graph.edges.filter(e => ids.has(e.source) && ids.has(e.target)) })
  }
  function changeEdges(changes: EdgeChange[]) {
    if (!editable) return
    setSelectedEdges(previous => { const next = new Set(previous); for (const change of changes) { if (change.type === 'select') { if (change.selected) next.add(change.id); else next.delete(change.id) } if (change.type === 'remove') next.delete(change.id) } return next })
    const removed = changes.filter(c => c.type === 'remove')
    if (removed.length) onChange({ ...graph, edges: applyEdgeChanges(removed, graph.edges) })
  }
  function connect(connection: Connection) { if (editable) onChange({ ...graph, edges: connectGraph(graph, connection) }) }
  return <div className="workflow-canvas" dir="ltr" data-testid="workflow-canvas" aria-label={t('canvas')}><ReactFlow nodes={nodes} nodesDraggable={editable} nodesConnectable={editable} edges={graph.edges.map(e => ({ ...e, selected: selectedEdges.has(e.id), label: e.sourceHandle ? t(e.sourceHandle === 'true' ? 'true' : 'false') : undefined, style: { stroke: e.sourceHandle === 'false' ? '#883250' : '#767c4c', strokeWidth: 2 } }))} nodeTypes={nodeTypes} onNodesChange={changeNodes} onEdgesChange={changeEdges} onConnect={connect} onNodeClick={(_, n) => onSelect(n.id)} onPaneClick={() => onSelect(null)} fitView fitViewOptions={{ padding: 0.3 }} minZoom={0.25} maxZoom={2} deleteKeyCode={['Backspace', 'Delete']} proOptions={{ hideAttribution: false }}><Background gap={22} size={1} color="#d7d5c6" /><Controls /><MiniMap pannable zoomable nodeColor="#a1a67d" /></ReactFlow><p className="canvas-guide">{t('canvasHint')}</p></div>
}
