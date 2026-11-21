import { beforeEach, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { apiGet, apiPost } from '@/lib/api'
import { loadDocuments, uploadDocument, useDocStore, useDocuments } from './useDocuments'
vi.mock('@/lib/api', () => ({ apiGet: vi.fn(), apiPost: vi.fn() }))
beforeEach(() => useDocStore.setState({ documents: [], error: null }))
it('replaces the library from the owner-scoped server list', async () => {
  useDocStore.setState({ documents: [{ id: 'stale' } as never] })
  vi.mocked(apiGet).mockResolvedValueOnce([{ id: 'd1', status: 'READY', filename: 'paper.pdf' }])
  await loadDocuments()
  expect(apiGet).toHaveBeenCalledWith('/documents')
  expect(useDocStore.getState().documents.map(d => d.id)).toEqual(['d1'])
})
it('uploads multipart and verifies the returned document status', async () => {
  vi.mocked(apiPost).mockResolvedValueOnce({ id: 'd2', status: 'QUEUED' })
  vi.mocked(apiGet).mockResolvedValueOnce({ id: 'd2', status: 'PROCESSING', filename: 'note.txt' })
  const file = new File(['hello'], 'note.txt', { type: 'text/plain' })
  expect(await uploadDocument(file)).toMatchObject({ id: 'd2', status: 'PROCESSING' })
  const form = vi.mocked(apiPost).mock.calls[0][1]?.body as FormData
  expect(form.get('file')).toBe(file)
  expect(useDocStore.getState().documents).toHaveLength(1)
})
it('does not restore an earlier owner library when its request finishes after unmount', async () => {
  let resolve!: (value: unknown) => void
  vi.mocked(apiGet).mockImplementationOnce(() => new Promise(done => { resolve = done }) as ReturnType<typeof apiGet>)
  const { unmount } = renderHook(() => useDocuments())
  unmount()
  await act(async () => { resolve([{ id: 'old-owner-document', status: 'READY' }]) })
  expect(useDocStore.getState().documents).toEqual([])
})
