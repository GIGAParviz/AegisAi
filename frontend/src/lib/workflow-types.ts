export const nodeKinds = ['start', 'llm', 'retrieve', 'tool', 'condition', 'approval', 'end'] as const
export type NodeKind = typeof nodeKinds[number]
export interface WorkflowNode { id: string; type: NodeKind; position: { x: number; y: number }; config: Record<string, unknown> }
export interface WorkflowEdge { id: string; source: string; target: string; sourceHandle?: string | null }
export interface Graph { nodes: WorkflowNode[]; edges: WorkflowEdge[] }
export interface Workflow extends Graph { id: string; name: string; description: string; created_at: string }
export interface Agent { id: string; name: string; system_prompt: string; model: string; allowed_tools: string[]; requires_approval: boolean; created_at: string }
export type AgentInput = Omit<Agent, 'id' | 'created_at'>
export interface WorkflowRun { id: string; workflow_id: string; status: 'running' | 'completed' | 'failed' | 'awaiting_approval' | 'rejected'; input: string; output: string | null; error: string | null; node_results: { node_id: string; status: string; output: unknown; error?: string | null }[]; pending_node_id?: string | null; created_at: string }
