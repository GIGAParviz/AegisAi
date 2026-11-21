import type { Graph, NodeKind, WorkflowEdge } from './workflow-types'
import { z } from 'zod'

// Keep these bounds aligned with app/schemas/workflow.py and the action registry.
const query = z.string().min(1).max(500)
const limit = z.number().int().min(1).max(20)
const empty = z.object({}).strict()
const configs = {
  start: empty,
  end: empty,
  llm: z.object({ prompt: z.string().min(1).max(16000), agent_id: z.string().nullable().optional() }).strict(),
  retrieve: z.object({ query, limit: limit.optional() }).strict(),
  condition: z.object({ contains: query }).strict(),
  approval: z.object({ message: z.string().min(1).max(2000) }).strict(),
  tool: z.discriminatedUnion('name', [
    z.object({ name: z.literal('search_docs'), arguments: z.object({ query, limit: limit.optional() }).strict() }).strict(),
    z.object({ name: z.literal('get_document'), arguments: z.object({ document_id: z.string().min(1).max(100) }).strict() }).strict(),
  ]),
}
function validTemplates(value: unknown): boolean {
  if (typeof value === 'string') return !/[{}]{2}/.test(value.replaceAll('{{input}}', '').replaceAll('{{previous}}', ''))
  if (Array.isArray(value)) return value.every(validTemplates)
  if (value && typeof value === 'object') return Object.values(value).every(validTemplates)
  return true
}
export function initialGraph(): Graph {
  return { nodes: [{ id: 'start', type: 'start', position: { x: 80, y: 160 }, config: {} }, { id: 'end', type: 'end', position: { x: 500, y: 160 }, config: {} }], edges: [{ id: 'start-end', source: 'start', target: 'end' }] }
}
export function defaultConfig(kind: NodeKind): Record<string, unknown> {
  switch (kind) {
    case 'llm': return { prompt: '{{input}}' }
    case 'retrieve': return { query: '{{input}}', limit: 5 }
    case 'tool': return { name: 'search_docs', arguments: { query: '{{input}}', limit: 5 } }
    case 'condition': return { contains: '' }
    case 'approval': return { message: '' }
    default: return {}
  }
}
export function connectGraph(graph: Graph, connection: { source: string; target: string; sourceHandle?: string | null }): WorkflowEdge[] {
  const source = graph.nodes.find(n => n.id === connection.source)
  const target = graph.nodes.find(n => n.id === connection.target)
  if (!source || !target || source.type === 'end' || target.type === 'start' || source.id === target.id) return graph.edges
  if (source.type === 'condition' && !['true', 'false'].includes(connection.sourceHandle ?? '')) return graph.edges
  const edge = { ...connection, id: crypto.randomUUID(), sourceHandle: source.type === 'condition' ? connection.sourceHandle : null }
  return [...graph.edges.filter(e => e.source !== source.id || (source.type === 'condition' && e.sourceHandle !== edge.sourceHandle)), edge]
}
export function removeNode(graph: Graph, id: string): Graph {
  return { nodes: graph.nodes.filter(n => n.id !== id), edges: graph.edges.filter(e => e.source !== id && e.target !== id) }
}
export function validateGraph(graph: Graph): string[] {
  const errors = new Set<string>()
  const ids = new Set(graph.nodes.map(n => n.id))
  const starts = graph.nodes.filter(n => n.type === 'start')
  if (graph.nodes.length < 2 || graph.nodes.length > 50 || graph.edges.length > 100 || JSON.stringify(graph).length > 128000) errors.add('limits')
  if (starts.length !== 1) errors.add('start')
  if (!graph.nodes.some(n => n.type === 'end')) errors.add('end')
  if (ids.size !== graph.nodes.length || new Set(graph.edges.map(e => e.id)).size !== graph.edges.length) errors.add('duplicate')
  if (graph.edges.some(e => !ids.has(e.source) || !ids.has(e.target))) errors.add('dangling')
  for (const node of graph.nodes) {
    const outgoing = graph.edges.filter(e => e.source === node.id)
    if (node.type === 'condition') {
      if (outgoing.length !== 2 || !outgoing.some(e => e.sourceHandle === 'true') || !outgoing.some(e => e.sourceHandle === 'false')) errors.add('branches')
    } else if (outgoing.length !== (node.type === 'end' ? 0 : 1) || outgoing.some(e => e.sourceHandle != null)) errors.add('outgoing')
    if (node.type === 'start' && graph.edges.some(e => e.target === node.id)) errors.add('startIncoming')
    if (!configs[node.type]?.safeParse(node.config).success || !validTemplates(node.config)) errors.add('config')
    if (!node.id || node.id.length > 100 || !Number.isFinite(node.position.x) || !Number.isFinite(node.position.y)) errors.add('config')
  }
  const visiting = new Set<string>(), visited = new Set<string>()
  function visit(id: string) {
    if (visiting.has(id)) { errors.add('cycle'); return }
    if (visited.has(id)) return
    visiting.add(id)
    graph.edges.filter(e => e.source === id).forEach(e => visit(e.target))
    visiting.delete(id); visited.add(id)
  }
  graph.nodes.forEach(n => visit(n.id))
  const reachable = new Set<string>()
  function reach(id: string) { if (reachable.has(id)) return; reachable.add(id); graph.edges.filter(e => e.source === id).forEach(e => reach(e.target)) }
  starts.forEach(n => reach(n.id))
  if (graph.nodes.some(n => !reachable.has(n.id))) errors.add('unreachable')
  return [...errors]
}
