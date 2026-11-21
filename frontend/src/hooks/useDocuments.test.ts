import { beforeEach, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { apiGet, apiPost } from '@/lib/api'
import { loadDocuments, refreshPending, uploadDocument, useDocStore, useDocuments } from './useDocuments'
vi.mock('@/lib/api', () => ({ apiGet: vi.fn(), apiPost: vi.fn() }))
beforeEach(() => useDocStore.setState({ documents: [], error: null }))
it('replaces the library from the owner-scoped server list', async () => {
  useDocStore.setState({ documents: [{ id: 'stale' } as never] })
  vi.mocked(apiGet).mockResolvedValueOnce([{ id: 'd1', status: 'ready', filename: 'paper.pdf' }])
  await loadDocuments()
  expect(apiGet).toHaveBeenCalledWith('/documents')
  expect(useDocStore.getState().documents.map(d => d.id)).toEqual(['d1'])
})
it('uploads multipart and verifies the returned document status', async () => {
  vi.mocked(apiPost).mockResolvedValueOnce({ id: 'd2', status: 'queued' })
  vi.mocked(apiGet).mockResolvedValueOnce({ id: 'd2', status: 'processing', filename: 'note.txt' })
  const file = new File(['hello'], 'note.txt', { type: 'text/plain' })
  expect(await uploadDocument(file)).toMatchObject({ id: 'd2', status: 'processing' })
  const form = vi.mocked(apiPost).mock.calls[0][1]?.body as FormData
  expect(form.get('file')).toBe(file)
  expect(useDocStore.getState().documents).toHaveLength(1)
})
it('polls queued and processing documents until the API marks them ready', async () => {
  vi.mocked(apiGet).mockResolvedValueOnce([{ id: 'd1', status: 'queued', filename: 'note.txt' }])
  await loadDocuments()

  for (const status of ['processing', 'ready']) {
    vi.mocked(apiGet).mockResolvedValueOnce({ id: 'd1', status, filename: 'note.txt' })
    await refreshPending()
    expect(apiGet).toHaveBeenLastCalledWith('/documents/d1')
    expect(useDocStore.getState().documents[0].status).toBe(status)
  }

  vi.mocked(apiGet).mockClear()
  await refreshPending()
  expect(apiGet).not.toHaveBeenCalled()
})
it('does not restore an earlier owner library when its request finishes after unmount', async () => {
  let resolve!: (value: unknown) => void
  vi.mocked(apiGet).mockImplementationOnce(() => new Promise(done => { resolve = done }) as ReturnType<typeof apiGet>)
  const { unmount } = renderHook(() => useDocuments())
  unmount()
  await act(async () => { resolve([{ id: 'old-owner-document', status: 'ready' }]) })
  expect(useDocStore.getState().documents).toEqual([])
})
