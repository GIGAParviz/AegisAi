import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, expect, it, vi } from 'vitest'
import messages from '@/messages/en.json'
import { workspaceApi } from '@/lib/workspace-api'
import type { WorkflowRun } from '@/lib/workflow-types'
import { RunResult } from './RunHistory'
const auth = vi.hoisted(() => ({ user: { role: 'ADMIN' } }))
vi.mock('@/stores/authStore', () => ({ useAuthStore: () => auth }))
vi.mock('@/lib/workspace-api', async original => ({ ...await original<typeof import('@/lib/workspace-api')>(), workspaceApi: { decide: vi.fn() } }))
const pending: WorkflowRun = { id: 'r1', workflow_id: 'w1', status: 'awaiting_approval', input: 'Question', output: null, error: null, node_results: [{ node_id: 'approval', status: 'awaiting_approval', output: 'Review this evidence' }], pending_node_id: 'approval', created_at: '' }
beforeEach(() => { vi.clearAllMocks(); auth.user.role = 'ADMIN' })
it.each(['approve', 'reject'] as const)('sends %s and displays only the persisted server decision', async decision => {
  const decided: WorkflowRun = { ...pending, status: decision === 'approve' ? 'completed' : 'rejected', pending_node_id: null }
  vi.mocked(workspaceApi.decide).mockResolvedValueOnce(decided)
  const onChange = vi.fn()
  render(<NextIntlClientProvider locale="en" messages={messages}><RunResult run={pending} onChange={onChange} /></NextIntlClientProvider>)
  expect(screen.getByText('Review this evidence')).toBeInTheDocument()
  fireEvent.click(screen.getByTestId(`${decision}-run`))
  await waitFor(() => expect(onChange).toHaveBeenCalledWith(decided))
  expect(workspaceApi.decide).toHaveBeenCalledWith('r1', decision)
})
it('recognizes the lowercase admin role returned by the backend', () => {
  auth.user.role = 'admin'
  render(<NextIntlClientProvider locale="en" messages={messages}><RunResult run={pending} onChange={vi.fn()} /></NextIntlClientProvider>)
  expect(screen.getByTestId('approve-run')).toBeInTheDocument()
  expect(screen.getByTestId('reject-run')).toBeInTheDocument()
})
it('does not expose decision controls to non-admin users', () => {
  auth.user.role = 'USER'
  render(<NextIntlClientProvider locale="en" messages={messages}><RunResult run={pending} onChange={vi.fn()} /></NextIntlClientProvider>)
  expect(screen.queryByTestId('approve-run')).not.toBeInTheDocument()
  expect(screen.queryByTestId('reject-run')).not.toBeInTheDocument()
  expect(screen.getByText(messages.workflows.adminRequired)).toBeInTheDocument()
})
it('retains pending state and shows API decision errors without fake completion', async () => {
  vi.mocked(workspaceApi.decide).mockRejectedValueOnce(new Error('Run is not awaiting approval'))
  const onChange = vi.fn()
  render(<NextIntlClientProvider locale="en" messages={messages}><RunResult run={pending} onChange={onChange} /></NextIntlClientProvider>)
  fireEvent.click(screen.getByTestId('approve-run'))
  expect(await screen.findByRole('alert')).toHaveTextContent('Run is not awaiting approval')
  expect(onChange).not.toHaveBeenCalled()
  expect(screen.getByTestId('approve-run')).toBeEnabled()
})
