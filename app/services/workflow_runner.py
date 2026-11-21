"""Bounded DAG interpreter; checkpoints are committed after each executed node."""
import asyncio
import json
from uuid import UUID

from langgraph.checkpoint.memory import MemorySaver

from app.agents.graph import AgentGraph
from app.db.models.policy_audit import PolicyDecision
from app.db.models.user import User
from app.policies.gate import ROLE_HIERARCHY
from app.services.llm import build_llm_provider
from app.services.retrieval import build_retrieval_store, retrieve_owned

MAX_OUTPUT = 64000


def text(value):
    return value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)


def render(value, run, previous):
    # Single-pass replacement: inserted user data is never re-interpolated.
    import re
    return re.sub(r"\{\{(input|previous)\}\}", lambda m: run.input if m[1] == "input" else previous, value)


def record(run, current, status, output=None, error=None):
    run.node_results = [item for item in run.node_results if item["node_id"] != current] + [
        {"node_id": current, "status": status, "output": output, "error": error}
    ]


async def pause(run, session, current):
    run.status, run.pending_node_id = "awaiting_approval", current
    record(run, current, "awaiting_approval")
    await session.commit()
    return run


def build_tool_graph():
    # We reuse execution + verification, not the conversational graph/checkpointer.
    # Workflow checkpoints and approvals live durably in workflow_runs.
    return AgentGraph(llm=build_llm_provider(), vector_store=build_retrieval_store(), checkpointer=MemorySaver())


async def original_actor(run, session):
    user = await session.get(User, UUID(run.actor["id"]))
    if user is None or not user.is_active or user.id != run.owner_id:
        raise ValueError("Original actor is unavailable")
    actor = dict(run.actor)
    original_level = next((level for role, level in ROLE_HIERARCHY.items() if role.value == actor["role"]), 0)
    if ROLE_HIERARCHY[user.role] < original_level:
        actor["role"] = user.role.value
    return actor


async def execute_run(run, session, approved_node=None):
    nodes = {n["id"]: n for n in run.snapshot["nodes"]}
    current = approved_node or next(n["id"] for n in nodes.values() if n["type"] == "start")
    completed = [item for item in run.node_results if item["status"] == "completed"]
    previous = text(completed[-1]["output"]) if completed else run.input
    run.pending_node_id = None
    try:
        actor = await original_actor(run, session)
        for _ in range(50 - len(completed)):
            node = nodes[current]
            kind, config = node["type"], node["config"]
            agent = run.snapshot.get("agents", {}).get(config.get("agent_id"), {})
            if (kind == "approval" or agent.get("requires_approval")) and approved_node != current:
                return await pause(run, session, current)
            if kind in {"start", "end", "approval"}:
                output = previous
            elif kind == "llm":
                messages = []
                if agent.get("system_prompt"):
                    messages.append({"role": "system", "content": agent["system_prompt"]})
                prompt = render(config["prompt"], run, previous)
                if len(prompt) > 16000:
                    raise ValueError("Expanded prompt limit exceeded")
                messages.append({"role": "user", "content": prompt})
                kwargs = {"model": agent["model"]} if agent.get("model") else {}
                output = await asyncio.wait_for(build_llm_provider().complete(messages, **kwargs), timeout=90)
            elif kind == "retrieve":
                query = render(config["query"], run, previous)
                if not 1 <= len(query) <= 500:
                    raise ValueError("Query limit exceeded")
                results = await asyncio.wait_for(retrieve_owned(session, build_retrieval_store(), actor["id"], query, config["limit"]), timeout=60)
                output = {"results": results}
            elif kind == "condition":
                output = render(config["contains"], run, previous) in previous
            elif kind == "tool":
                graph = build_tool_graph()
                arguments = {key: render(value, run, previous) if isinstance(value, str) else value for key, value in config["arguments"].items()}
                proposal = graph.registry.parse_proposal(json.dumps({"name": config["name"], "arguments": arguments}))
                decision = await graph.gate.check(proposal, actor, session)
                # Audit authorization independently of a later execution rollback.
                await session.commit()
                if decision.decision == PolicyDecision.DENY:
                    raise ValueError("Policy denied tool")
                if decision.decision == PolicyDecision.PENDING_APPROVAL and approved_node != current:
                    return await pause(run, session, current)
                output = await asyncio.wait_for(graph.execute_verified_action(proposal, actor, session), timeout=60)
            else:
                raise ValueError("Unsupported node")
            if len(text(output)) > MAX_OUTPUT:
                raise ValueError("Node output limit exceeded")
            record(run, current, "completed", output)
            previous = text(output)
            if kind == "end":
                run.status, run.output = "completed", previous
                await session.commit()
                return run
            await session.commit()
            branch = ("true" if output else "false") if kind == "condition" else None
            current = next(e["target"] for e in run.snapshot["edges"] if e["source"] == current and e.get("sourceHandle") == branch)
            approved_node = None
        raise ValueError("Execution step limit exceeded")
    except Exception:  # noqa: BLE001 — persist/sanitize failures at the API boundary
        # Flush/commit errors poison the transaction; discard partial node writes
        # and reload the last durable checkpoint before recording a safe failure.
        await session.rollback()
        await session.refresh(run)
        run.status, run.error, run.pending_node_id = "failed", "Node execution failed", None
        record(run, current, "failed", error=run.error)
        await session.commit()
        return run
