import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, expect, it, vi } from 'vitest'
import messages from '@/messages/en.json'
import fa from '@/messages/fa.json'
import type { Document, ChatMessage } from '@/lib/types'
import ChatWorkspace from './ChatWorkspace'
import { uploadDocument } from '@/hooks/useDocuments'
const state = vi.hoisted(() => ({ documents: [] as Document[], messages: [] as ChatMessage[], params: '', sendMessage: vi.fn().mockResolvedValue(undefined) }))
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(state.params) }))
vi.mock('@/hooks/useDocuments', () => ({ useDocuments: () => ({ documents: state.documents, loading: false, error: null }), loadDocuments: vi.fn().mockResolvedValue([]), refreshPending: vi.fn().mockResolvedValue(undefined), uploadDocument: vi.fn() }))
vi.mock('@/hooks/useChat', () => ({ useChat: () => ({ messages: state.messages, streaming: false, error: null, sendMessage: state.sendMessage, clearMessages: vi.fn(), stopStreaming: vi.fn() }) }))
const ready: Document = { id: 'd1', filename: 'source.pdf', status: 'ready', mime: 'application/pdf', owner_id: 'u1', error: null, created_at: '' }
beforeEach(() => { vi.clearAllMocks(); state.params = ''; state.documents = [ready]; state.messages = [{ role: 'assistant', content: 'Grounded answer', citations: [{ document_id: 'd1', chunk_index: 3, text: 'Original passage' }], trace_id: 'trace-1' }]; vi.mocked(uploadDocument).mockResolvedValue({ ...ready, id: 'd2', filename: 'new.txt', status: 'queued' }) })
const view = () => <NextIntlClientProvider locale="en" messages={messages}><ChatWorkspace /></NextIntlClientProvider>
it('renders real citation passages and accepts an attached file', async () => {
  render(view())
  expect(screen.getByText('Grounded answer')).toBeInTheDocument()
  expect(screen.getByText('Original passage').closest('details')).toHaveTextContent('source.pdf')
  const file = new File(['contents'], 'new.txt', { type: 'text/plain' })
  fireEvent.change(screen.getByTestId('chat-file-input'), { target: { files: [file] } })
  await waitFor(() => expect(uploadDocument).toHaveBeenCalledWith(file))
  expect(await screen.findByTestId('attachment-chip')).toHaveTextContent('d2')
  fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'Question' } })
  expect(screen.getByTestId('send-chat')).toBeDisabled()
})
it('waits for selected documents to finish processing then sends their IDs', async () => {
  state.documents = [{ ...ready, status: 'queued' }]
  const { rerender } = render(view())
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'Question' } })
  expect(screen.getByTestId('attachment-chip')).toHaveTextContent(messages.documents.statusQueued)
  expect(screen.getByTestId('send-chat')).toBeDisabled()
  state.documents = [{ ...ready, status: 'processing' }]
  rerender(view())
  expect(screen.getByTestId('attachment-chip')).toHaveTextContent(messages.documents.statusProcessing)
  expect(screen.getByTestId('send-chat')).toBeDisabled()
  state.documents = [ready]; rerender(view())
  expect(screen.getByTestId('attachment-chip')).toHaveTextContent(messages.documents.statusReady)
  expect(screen.getByTestId('send-chat')).toBeEnabled()
  fireEvent.click(screen.getByTestId('send-chat'))
  await waitFor(() => expect(state.sendMessage).toHaveBeenCalledWith('Question', { documentIds: ['d1'] }))
})
it('requires removal of an unavailable deep-linked attachment before sending', () => {
  state.params = 'doc=missing'
  render(view())
  fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'Question' } })
  expect(screen.getByTestId('send-chat')).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Remove attachment missing' }))
  expect(screen.getByTestId('send-chat')).toBeEnabled()
})
it('shows upload errors without adding an attachment or inventing success', async () => {
  vi.mocked(uploadDocument).mockRejectedValueOnce(new Error('Storage unavailable'))
  render(view())
  fireEvent.change(screen.getByTestId('chat-file-input'), { target: { files: [new File(['x'], 'new.txt')] } })
  expect(await screen.findByRole('alert')).toHaveTextContent('Storage unavailable')
  expect(screen.queryByTestId('attachment-chip')).not.toBeInTheDocument()
})
it('renders the actual metadata-only citation contract without presenting a heading as an excerpt', () => {
  state.messages = [{ role: 'assistant', content: 'Answer', citations: [{ document_id: 'd1', filename: 'source.pdf', chunk_index: 2, heading: 'Introduction', score: 0.8 }] }]
  render(view())
  expect(screen.getByText(messages.chat.sourceNoExcerpt)).toBeInTheDocument()
  expect(screen.getByText('Introduction')).toBeInTheDocument()
  expect(screen.getByText('#2')).toBeInTheDocument()
})
it('supports Persian labels and explains that only selected documents provide context', () => {
  render(<NextIntlClientProvider locale="fa" messages={fa}><ChatWorkspace /></NextIntlClientProvider>)
  expect(screen.getByRole('heading', { name: fa.chat.title })).toBeInTheDocument()
  expect(screen.getByText(fa.documents.statusReady)).toBeInTheDocument()
  expect(screen.getByText(fa.chat.libraryHint)).toBeInTheDocument()
  expect(messages.chat.libraryHint).toContain('Without a selection, no document context is sent')
})
