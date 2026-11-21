import { HTTPError } from 'ky'
import { api, apiGet, apiPost, apiPut } from './api'
import type { Agent, AgentInput, Workflow, WorkflowRun } from './workflow-types'
export type WorkflowInput = Pick<Workflow, 'name' | 'description' | 'nodes' | 'edges'>
export const workspaceApi = {
  agents: () => apiGet<Agent[]>('/agents'),
  async saveAgent(id: string | null, input: AgentInput) {
    const saved = id ? await apiPut<Agent>(`/agents/${id}`, { json: input }) : await apiPost<Agent>('/agents', { json: input })
    return apiGet<Agent>(`/agents/${saved.id}`)
  },
  async deleteAgent(id: string) { await api.delete(`/agents/${id}`); const list = await workspaceApi.agents(); if (list.some(a => a.id === id)) throw new Error('Delete was not confirmed'); return list },
  workflows: () => apiGet<Workflow[]>('/workflows'),
  workflow: (id: string) => apiGet<Workflow>(`/workflows/${id}`),
  async saveWorkflow(id: string | null, input: WorkflowInput) {
    const saved = id ? await apiPut<Workflow>(`/workflows/${id}`, { json: input }) : await apiPost<Workflow>('/workflows', { json: input })
    return workspaceApi.workflow(saved.id)
  },
  async deleteWorkflow(id: string) { await api.delete(`/workflows/${id}`); const list = await workspaceApi.workflows(); if (list.some(w => w.id === id)) throw new Error('Delete was not confirmed'); return list },
  runs: () => apiGet<WorkflowRun[]>('/workflow-runs'),
  run: (id: string) => apiGet<WorkflowRun>(`/workflow-runs/${id}`),
  async startRun(id: string, input: string) { const run = await apiPost<WorkflowRun>(`/workflows/${id}/runs`, { json: { input }, timeout: 180000 }); return workspaceApi.run(run.id) },
  async decide(id: string, decision: 'approve' | 'reject') { await apiPost<WorkflowRun>(`/workflow-runs/${id}/decision`, { json: { decision }, timeout: 180000 }); return workspaceApi.run(id) },
}
export async function errorMessage(error: unknown): Promise<string> {
  if (error instanceof HTTPError) {
    try { const data = await error.response.clone().json(); return typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail ?? data) } catch { return `${error.response.status} ${error.response.statusText}` }
  }
  return error instanceof Error ? error.message : String(error)
}
