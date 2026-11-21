import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { expect, it, vi } from 'vitest'
import messages from '@/messages/en.json'
import { initialGraph } from '@/lib/graph'
import type { Edge, EdgeChange, NodeChange, Node } from '@xyflow/react'
import GraphCanvas from './GraphCanvas'

// Exercise the controlled XYFlow boundary: selection is UI state, never API data.
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ edges, onEdgesChange, onNodesChange }: { edges: Edge[]; onEdgesChange: (changes: EdgeChange[]) => void; onNodesChange: (changes: NodeChange<Node>[]) => void }) => <div>
    <button data-testid="select-edge" onClick={() => onEdgesChange([{ id: 'start-end', type: 'select', selected: true }])}>Select</button>
    <button data-testid="remove-edge" onClick={() => onEdgesChange([{ id: 'start-end', type: 'remove' }])}>Remove</button>
    <button data-testid="move-node" onClick={() => onNodesChange([{ id: 'start', type: 'position', position: { x: 100, y: 200 } }])}>Move</button>
    <output data-testid="edge-selected">{String(edges[0]?.selected ?? false)}</output>
  </div>,
  Background: () => null, Controls: () => null, MiniMap: () => null, Handle: () => null,
  Position: { Left: 'left', Right: 'right' },
  applyNodeChanges: vi.fn(), applyEdgeChanges: (changes: EdgeChange[], edges: Edge[]) => edges.filter(e => !changes.some(c => c.type === 'remove' && c.id === e.id)),
}))
it('keeps edge selection visible without persisting XYFlow-only fields', () => {
  const graph = initialGraph(), onChange = vi.fn()
  render(<NextIntlClientProvider locale="en" messages={messages}><GraphCanvas graph={graph} onChange={onChange} selectedId={null} onSelect={vi.fn()} run={null} /></NextIntlClientProvider>)
  fireEvent.click(screen.getByTestId('select-edge'))
  expect(screen.getByTestId('edge-selected')).toHaveTextContent('true')
  expect(onChange).not.toHaveBeenCalled()
  fireEvent.click(screen.getByTestId('remove-edge'))
  expect(onChange).toHaveBeenLastCalledWith({ nodes: graph.nodes, edges: [] })
})
it('blocks graph edits while the editor is locked', () => {
  const onChange = vi.fn()
  render(<NextIntlClientProvider locale="en" messages={messages}><GraphCanvas graph={initialGraph()} onChange={onChange} selectedId={null} onSelect={vi.fn()} run={null} editable={false} /></NextIntlClientProvider>)
  fireEvent.click(screen.getByTestId('remove-edge'))
  fireEvent.click(screen.getByTestId('move-node'))
  expect(onChange).not.toHaveBeenCalled()
})
