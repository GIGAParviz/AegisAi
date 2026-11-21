import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, expect, it, vi } from 'vitest'
import messages from '@/messages/en.json'
import { workspaceApi } from '@/lib/workspace-api'
import Agents from './Agents'
vi.mock('@/components/layout/WorkspaceShell', () => ({ PageBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
vi.mock('@/lib/workspace-api', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/workspace-api')>(), workspaceApi: { agents: vi.fn().mockResolvedValue([]), saveAgent: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())
it('creates a definition using explicit settings and shows server errors', async () => {
  vi.mocked(workspaceApi.saveAgent).mockRejectedValueOnce(new Error('Unknown model'))
  render(<NextIntlClientProvider locale="en" messages={messages}><Agents /></NextIntlClientProvider>)
  await screen.findByTestId('new-agent')
  fireEvent.click(screen.getByTestId('new-agent'))
  fireEvent.change(screen.getByTestId('agent-name'), { target: { value: 'Researcher' } })
  fireEvent.change(screen.getByTestId('agent-model'), { target: { value: 'local' } })
  fireEvent.change(screen.getByTestId('agent-prompt'), { target: { value: 'Use evidence' } })
  fireEvent.click(screen.getByTestId('save-agent'))
  await waitFor(() => expect(workspaceApi.saveAgent).toHaveBeenCalledWith(null, { name: 'Researcher', model: 'local', system_prompt: 'Use evidence', allowed_tools: [], requires_approval: false }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Unknown model')
})
it('locks the draft during persistence then displays verified settings from the server', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof workspaceApi.saveAgent>>) => void
  vi.mocked(workspaceApi.saveAgent).mockImplementationOnce(() => new Promise(done => { resolve = done }))
  render(<NextIntlClientProvider locale="en" messages={messages}><Agents /></NextIntlClientProvider>)
  await waitFor(() => expect(screen.queryByText(messages.common.loading)).not.toBeInTheDocument())
  fireEvent.click(screen.getByTestId('new-agent'))
  fireEvent.change(screen.getByTestId('agent-name'), { target: { value: 'Researcher' } })
  fireEvent.change(screen.getByTestId('agent-model'), { target: { value: 'local' } })
  fireEvent.change(screen.getByTestId('agent-prompt'), { target: { value: 'Use evidence' } })
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByTestId('save-agent'))
  expect(screen.getByTestId('agent-name')).toBeDisabled()
  expect(screen.getByTestId('new-agent')).toBeDisabled()
  await act(async () => { resolve({ id: 'a1', name: 'Researcher', model: 'local', system_prompt: 'Use evidence', allowed_tools: [], requires_approval: true, created_at: '' }) })
  expect(workspaceApi.saveAgent).toHaveBeenCalledWith(null, expect.objectContaining({ requires_approval: true, allowed_tools: [] }))
  expect(await screen.findByText(messages.agents.saved)).toBeInTheDocument()
  expect(screen.getByTestId('agent-name')).toBeEnabled()
})
