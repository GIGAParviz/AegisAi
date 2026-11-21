// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import { workspaceApi } from './workspace-api'
import { setAuthTokens, clearAuthTokens } from './api'
import { initialGraph } from './graph'
afterEach(() => { vi.unstubAllGlobals(); clearAuthTokens() })
it('saves an agent with bearer authentication and reads the persisted target', async () => {
  setAuthTokens('test-access', 'test-refresh')
  const agent = { id: 'a1', name: 'Analyst', model: 'local', system_prompt: 'Careful', allowed_tools: [], requires_approval: true, created_at: '' }
  let payload: unknown
  const fetcher = vi.fn().mockImplementation(async (request: Request) => { if (request.method === 'POST') payload = await request.clone().json(); return new Response(JSON.stringify(agent), { status: 200, headers: { 'Content-Type': 'application/json' } }) })
  vi.stubGlobal('fetch', fetcher)
  const input = { name: agent.name, model: agent.model, system_prompt: agent.system_prompt, allowed_tools: agent.allowed_tools, requires_approval: agent.requires_approval }
  expect(await workspaceApi.saveAgent(null, input)).toEqual(agent)
  const request = fetcher.mock.calls[0][0] as Request
  expect(request.method).toBe('POST')
  expect(request.headers.get('Authorization')).toBe('Bearer test-access')
  expect(payload).toEqual(input)
  expect((fetcher.mock.calls[1][0] as Request).url).toBe('http://localhost:8000/agents/a1')
})
it('does not report success on validation errors', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'Unknown model' }), { status: 422 })))
  await expect(workspaceApi.startRun('w1', 'hello')).rejects.toThrow()
})
it('saves strict workflow payloads and reads the saved target before returning', async () => {
  const input = { ...initialGraph(), name: 'Echo', description: '' }
  const saved = { ...input, id: 'w1', created_at: '' }
  const requests: { path: string; method: string; body?: unknown }[] = []
  vi.stubGlobal('fetch', vi.fn(async (request: Request) => {
    requests.push({ path: new URL(request.url).pathname, method: request.method, body: request.method === 'PUT' ? await request.json() : undefined })
    return Response.json(saved)
  }))
  expect(await workspaceApi.saveWorkflow('w1', input)).toEqual(saved)
  expect(requests).toEqual([{ path: '/workflows/w1', method: 'PUT', body: input }, { path: '/workflows/w1', method: 'GET', body: undefined }])
})
it.each(['approve', 'reject'] as const)('posts an explicit %s decision and reads the exact run', async decision => {
  setAuthTokens('owner-token', 'refresh')
  const requests: { path: string; method: string; body?: unknown }[] = []
  const run = { id: 'r1', workflow_id: 'w1', status: decision === 'approve' ? 'completed' : 'rejected' }
  vi.stubGlobal('fetch', vi.fn(async (request: Request) => {
    expect(request.headers.get('Authorization')).toBe('Bearer owner-token')
    requests.push({ path: new URL(request.url).pathname, method: request.method, body: request.method === 'POST' ? await request.json() : undefined })
    return Response.json(run)
  }))
  expect(await workspaceApi.decide('r1', decision)).toEqual(run)
  expect(requests).toEqual([{ path: '/workflow-runs/r1/decision', method: 'POST', body: { decision } }, { path: '/workflow-runs/r1', method: 'GET', body: undefined }])
})
it('starts a run with explicit input and reads its persisted result', async () => {
  const requests: { path: string; method: string; body?: unknown }[] = []
  vi.stubGlobal('fetch', vi.fn(async (request: Request) => {
    requests.push({ path: new URL(request.url).pathname, method: request.method, body: request.method === 'POST' ? await request.json() : undefined })
    return Response.json({ id: 'r1', status: 'awaiting_approval' })
  }))
  expect(await workspaceApi.startRun('w1', 'Question')).toMatchObject({ id: 'r1', status: 'awaiting_approval' })
  expect(requests).toEqual([{ path: '/workflows/w1/runs', method: 'POST', body: { input: 'Question' } }, { path: '/workflow-runs/r1', method: 'GET', body: undefined }])
})
it('does not claim a save succeeded when the verification read fails', async () => {
  vi.stubGlobal('fetch', vi.fn(async (request: Request) => request.method === 'POST' ? Response.json({ id: 'w1' }) : Response.json({ detail: 'Not found' }, { status: 404 })))
  await expect(workspaceApi.saveWorkflow(null, { ...initialGraph(), name: 'Echo', description: '' })).rejects.toThrow()
})
it('verifies deletions against the owner-scoped list', async () => {
  const fetcher = vi.fn(async (request: Request) => request.method === 'DELETE' ? new Response(null, { status: 204 }) : Response.json([{ id: 'a1' }]))
  vi.stubGlobal('fetch', fetcher)
  await expect(workspaceApi.deleteAgent('a1')).rejects.toThrow('Delete was not confirmed')
  expect(fetcher).toHaveBeenCalledTimes(2)
})
