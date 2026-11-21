import { describe, expect, it } from 'vitest'
import { initialGraph, validateGraph, connectGraph, removeNode, defaultConfig } from './graph'
import type { NodeKind } from './workflow-types'

describe('workflow graph', () => {
  it('starts with a connected valid start and end', () => {
    const graph = initialGraph()
    expect(validateGraph(graph)).toEqual([])
    expect(graph.nodes.map(n => n.type)).toEqual(['start', 'end'])
  })
  it('replaces a single outgoing edge and removes dangling edges', () => {
    const graph = initialGraph()
    graph.nodes.push({ id: 'llm', type: 'llm', position: { x: 200, y: 100 }, config: { prompt: '{{input}}' } })
    const connection = { source: 'start', target: 'llm', sourceHandle: null, targetHandle: null }
    const edges = connectGraph(graph, connection)
    expect(edges.filter(e => e.source === 'start')).toHaveLength(1)
    expect(edges[0].target).toBe('llm')
    expect(edges[0]).not.toHaveProperty('targetHandle')
    expect(removeNode({ ...graph, edges }, 'llm').edges).toEqual([])
  })
  it('requires both named condition branches and rejects cycles', () => {
    const graph = initialGraph()
    graph.nodes.push({ id: 'c', type: 'condition', position: { x: 200, y: 100 }, config: { contains: 'yes' } })
    graph.edges = [{ id: 'a', source: 'start', target: 'c' }, { id: 'b', source: 'c', target: 'end', sourceHandle: 'true' }]
    expect(validateGraph(graph)).toContain('branches')
    graph.edges.push({ id: 'd', source: 'c', target: 'c', sourceHandle: 'false' })
    expect(validateGraph(graph)).toContain('cycle')
  })
  it.each([
    ['retrieve', { query: 'question', limit: 21 }],
    ['llm', { prompt: '{{secret}}' }],
    ['llm', { prompt: 'hello', api_key: 'not allowed' }],
    ['condition', { contains: '' }],
    ['approval', { message: '' }],
    ['tool', { name: 'shell', arguments: {} }],
    ['tool', { name: 'search_docs', arguments: { query: 'x', limit: 21 } }],
    ['tool', { name: 'search_docs', arguments: { query: 'x', extra: true } }],
    ['tool', { name: 'get_document', arguments: { document_id: '' } }],
    ['start', { unexpected: true }],
  ] as [NodeKind, Record<string, unknown>][])('rejects invalid %s configuration before calling the strict backend', (type, config) => {
    const graph = initialGraph()
    graph.nodes.push({ id: 'step', type, config, position: { x: 200, y: 100 } })
    expect(validateGraph(graph)).toContain('config')
  })
  it('uses a registered tool and valid arguments for a new tool node', () => {
    expect(defaultConfig('tool')).toEqual({ name: 'search_docs', arguments: { query: '{{input}}', limit: 5 } })
  })
  it('rejects labelled ordinary edges and graphs above the backend limits', () => {
    const graph = initialGraph()
    graph.edges[0].sourceHandle = 'true'
    expect(validateGraph(graph)).toContain('outgoing')
    graph.nodes.push(...Array.from({ length: 49 }, (_, i) => ({ ...graph.nodes[1], id: `end-${i}` })))
    expect(validateGraph(graph)).toContain('limits')
  })
})
