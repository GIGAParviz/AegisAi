import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, expect, it, vi } from 'vitest'
import messages from '@/messages/en.json'
import { workspaceApi } from '@/lib/workspace-api'
import WorkflowEditor from './WorkflowEditor'
import { initialGraph } from '@/lib/graph'
vi.mock('@/lib/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }), Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }))
vi.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ user: { role: 'USER' } }) }))
vi.mock('./GraphCanvas', () => ({ default: () => <div data-testid="graph-canvas" /> }))
vi.mock('@/lib/workspace-api', async original => ({ ...await original<typeof import('@/lib/workspace-api')>(), workspaceApi: { agents: vi.fn().mockResolvedValue([]), runs: vi.fn().mockResolvedValue([]), workflow: vi.fn(), saveWorkflow: vi.fn(), startRun: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())
it('saves the graph before enabling a real persisted run', async () => {
  vi.mocked(workspaceApi.saveWorkflow).mockImplementation(async (_id, value) => ({ ...value, id: 'w1', created_at: '' }))
  vi.mocked(workspaceApi.startRun).mockResolvedValue({ id: 'r1', workflow_id: 'w1', status: 'completed', input: 'hello', output: 'hello', error: null, node_results: [{ node_id: 'start', status: 'completed', output: 'hello' }], created_at: '' })
  render(<NextIntlClientProvider locale="en" messages={messages}><WorkflowEditor workflowId={null} /></NextIntlClientProvider>)
  expect(screen.getByTestId('run-workflow')).toBeDisabled()
  fireEvent.change(screen.getByTestId('workflow-name'), { target: { value: 'Echo' } })
  fireEvent.click(screen.getByTestId('save-workflow'))
  await waitFor(() => expect(workspaceApi.saveWorkflow).toHaveBeenCalledWith(null, expect.objectContaining({ name: 'Echo', nodes: expect.arrayContaining([expect.objectContaining({ type: 'start' })]) })))
  await waitFor(() => expect(screen.getByTestId('run-workflow')).toBeEnabled())
  fireEvent.change(screen.getByTestId('run-input'), { target: { value: 'hello' } })
  fireEvent.click(screen.getByTestId('run-workflow'))
  await waitFor(() => expect(workspaceApi.startRun).toHaveBeenCalledWith('w1', 'hello'))
  expect(await screen.findByTestId('run-result-r1')).toHaveTextContent('hello')
})
it('cannot overwrite or run an existing workflow that failed to load', async () => {
  vi.mocked(workspaceApi.workflow).mockRejectedValueOnce(new Error('Not found'))
  render(<NextIntlClientProvider locale="en" messages={messages}><WorkflowEditor workflowId="missing" /></NextIntlClientProvider>)
  expect(await screen.findByRole('alert')).toHaveTextContent('Not found')
  expect(screen.getByTestId('save-workflow')).toBeDisabled()
  expect(screen.getByTestId('run-workflow')).toBeDisabled()
  expect(screen.getByTestId('workflow-name')).toBeDisabled()
})
it('locks editing while a save is pending so late edits cannot be marked persisted', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof workspaceApi.saveWorkflow>>) => void
  vi.mocked(workspaceApi.saveWorkflow).mockImplementationOnce(() => new Promise(done => { resolve = done }))
  render(<NextIntlClientProvider locale="en" messages={messages}><WorkflowEditor workflowId={null} /></NextIntlClientProvider>)
  fireEvent.change(screen.getByTestId('workflow-name'), { target: { value: 'Echo' } })
  fireEvent.click(screen.getByTestId('save-workflow'))
  expect(screen.getByTestId('workflow-name')).toBeDisabled()
  expect(screen.getByTestId('workflow-description')).toBeDisabled()
  resolve({ ...initialGraph(), id: 'w1', name: 'Echo', description: '', created_at: '' })
  await waitFor(() => expect(screen.getByTestId('workflow-name')).toBeEnabled())
})
