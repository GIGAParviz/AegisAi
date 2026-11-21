import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useChat } from './useChat'
afterEach(() => vi.unstubAllGlobals())
it('sends selected attachments with authenticated chat and retains citations on the response', async () => {
  document.cookie = 'access_token=chat-test; path=/'
  const wire = 'event: token\r\ndata: "Evidence"\r\n\r\nevent: done\r\ndata: {"trace_id":"t1","citations":[{"document_id":"d1","chunk_index":2,"text":"source passage"}]}\r\n\r\n'
  const bytes = new TextEncoder().encode(wire)
  const fetcher = vi.fn().mockResolvedValue(new Response(new ReadableStream({ start(c) { c.enqueue(bytes.slice(0, 26)); c.enqueue(bytes.slice(26)); c.close() } })))
  vi.stubGlobal('fetch', fetcher)
  const { result } = renderHook(() => useChat())
  await act(async () => { await result.current.sendMessage('Question', { documentIds: ['d1'] }) })
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ document_ids: ['d1'], messages: [{ role: 'user', content: 'Question' }] })
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer chat-test')
  expect(result.current.messages.at(-1)).toMatchObject({ content: 'Evidence', trace_id: 't1', citations: [{ document_id: 'd1', chunk_index: 2 }] })
})
it('reports a dropped stream instead of claiming completion', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('event: token\ndata: "partial"\n\n')))
  const { result } = renderHook(() => useChat())
  await act(async () => { await result.current.sendMessage('Question') })
  expect(result.current.error).toBeTruthy()
  expect(result.current.streaming).toBe(false)
})
it('retains the server trace on an SSE error without signalling completion', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('event: error\ndata: {"trace_id":"failed-trace","error":"stream_failed"}\n\n')))
  const onDone = vi.fn(), onError = vi.fn()
  const { result } = renderHook(() => useChat())
  await act(async () => { await result.current.sendMessage('Question', { onDone, onError }) })
  expect(result.current.error).toBe('stream_failed')
  expect(result.current.messages.at(-1)?.trace_id).toBe('failed-trace')
  expect(onError).toHaveBeenCalledWith('stream_failed', 'failed-trace')
  expect(onDone).not.toHaveBeenCalled()
})
