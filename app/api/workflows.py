from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.db.engine import get_session
from app.db.models.document import Document
from app.db.models.policy_audit import PolicyAudit, PolicyDecision
from app.db.models.user import User, UserRole
from app.db.models.workflow import AgentDefinition, Workflow, WorkflowRun
from app.schemas.workflow import (
    AgentResponse,
    AgentWrite,
    DecisionRequest,
    RunRequest,
    RunResponse,
    WorkflowResponse,
    WorkflowWrite,
)
from app.services.workflow_runner import execute_run

router = APIRouter(tags=["builder"])
Session = Annotated[AsyncSession, Depends(get_session)]
Actor = Annotated[User, Depends(get_current_user)]


async def owned(session, model, identifier, user):
    obj = await session.scalar(select(model).where(model.id == identifier, model.owner_id == user.id))
    if obj is None:
        raise HTTPException(404, "Not found")
    return obj


async def snapshot_agents(nodes, session, user):
    snapshots = {}
    for node in nodes:
        config = node["config"] if isinstance(node, dict) else node.config
        kind = node["type"] if isinstance(node, dict) else node.type
        if kind == "tool" and config["name"] == "get_document":
            doc_id = config["arguments"]["document_id"]
            if "{{" not in doc_id:
                try:
                    identifier = UUID(doc_id)
                except ValueError as exc:
                    raise HTTPException(422, "Invalid document ID") from exc
                await owned(session, Document, identifier, user)
        agent_id = config.get("agent_id")
        if agent_id:
            try:
                identifier = UUID(agent_id)
            except ValueError as exc:
                raise HTTPException(422, "Invalid agent ID") from exc
            agent = await owned(session, AgentDefinition, identifier, user)
            snapshots[agent_id] = AgentWrite.model_validate(agent, from_attributes=True).model_dump()
    return snapshots


@router.post("/agents", response_model=AgentResponse, status_code=201)
async def create_agent(body: AgentWrite, session: Session, user: Actor):
    obj = AgentDefinition(owner_id=user.id, **body.model_dump())
    session.add(obj)
    await session.commit()
    await session.refresh(obj)
    return obj


@router.get("/agents", response_model=list[AgentResponse])
async def list_agents(session: Session, user: Actor):
    return (await session.scalars(select(AgentDefinition).where(AgentDefinition.owner_id == user.id).order_by(AgentDefinition.created_at))).all()


@router.get("/agents/{identifier}", response_model=AgentResponse)
async def get_agent(identifier: UUID, session: Session, user: Actor):
    return await owned(session, AgentDefinition, identifier, user)


@router.put("/agents/{identifier}", response_model=AgentResponse)
async def update_agent(identifier: UUID, body: AgentWrite, session: Session, user: Actor):
    obj = await owned(session, AgentDefinition, identifier, user)
    for key, value in body.model_dump().items():
        setattr(obj, key, value)
    await session.commit()
    await session.refresh(obj)
    return obj


@router.delete("/agents/{identifier}", status_code=204)
async def delete_agent(identifier: UUID, session: Session, user: Actor):
    obj = await owned(session, AgentDefinition, identifier, user)
    await session.delete(obj)
    await session.commit()
    return Response(status_code=204)


@router.post("/workflows", response_model=WorkflowResponse, status_code=201)
async def create_workflow(body: WorkflowWrite, session: Session, user: Actor):
    await snapshot_agents(body.nodes, session, user)
    obj = Workflow(owner_id=user.id, **body.model_dump())
    session.add(obj)
    await session.commit()
    await session.refresh(obj)
    return obj


@router.get("/workflows", response_model=list[WorkflowResponse])
async def list_workflows(session: Session, user: Actor):
    return (await session.scalars(select(Workflow).where(Workflow.owner_id == user.id).order_by(Workflow.created_at))).all()


@router.get("/workflows/{identifier}", response_model=WorkflowResponse)
async def get_workflow(identifier: UUID, session: Session, user: Actor):
    return await owned(session, Workflow, identifier, user)


@router.put("/workflows/{identifier}", response_model=WorkflowResponse)
async def update_workflow(identifier: UUID, body: WorkflowWrite, session: Session, user: Actor):
    obj = await owned(session, Workflow, identifier, user)
    await snapshot_agents(body.nodes, session, user)
    for key, value in body.model_dump().items():
        setattr(obj, key, value)
    await session.commit()
    await session.refresh(obj)
    return obj


@router.delete("/workflows/{identifier}", status_code=204)
async def delete_workflow(identifier: UUID, session: Session, user: Actor):
    obj = await owned(session, Workflow, identifier, user)
    await session.delete(obj)
    await session.commit()
    return Response(status_code=204)


@router.post("/workflows/{identifier}/runs", response_model=RunResponse, status_code=201)
async def start_run(identifier: UUID, body: RunRequest, session: Session, user: Actor):
    workflow = await owned(session, Workflow, identifier, user)
    agents = await snapshot_agents(workflow.nodes, session, user)
    run = WorkflowRun(owner_id=user.id, workflow_id=workflow.id,
                      snapshot={"nodes": workflow.nodes, "edges": workflow.edges, "agents": agents},
                      actor={"id": str(user.id), "role": user.role.value}, input=body.input)
    session.add(run)
    await session.commit()
    await session.refresh(run)
    return await execute_run(run, session)


@router.get("/workflow-runs", response_model=list[RunResponse])
async def list_runs(session: Session, user: Actor):
    return (await session.scalars(select(WorkflowRun).where(WorkflowRun.owner_id == user.id).order_by(WorkflowRun.created_at.desc()))).all()


@router.get("/workflow-runs/{identifier}", response_model=RunResponse)
async def get_run(identifier: UUID, session: Session, user: Actor):
    return await owned(session, WorkflowRun, identifier, user)


@router.post("/workflow-runs/{identifier}/decision", response_model=RunResponse)
async def decide_run(identifier: UUID, body: DecisionRequest, session: Session,
                     admin: Annotated[User, Depends(require_roles(UserRole.ADMIN))]):
    run = await owned(session, WorkflowRun, identifier, admin)
    pending = run.pending_node_id
    # Atomic compare-and-set serializes decisions across processes, including SQLite.
    claimed = await session.execute(update(WorkflowRun).where(
        WorkflowRun.id == identifier, WorkflowRun.owner_id == admin.id,
        WorkflowRun.status == "awaiting_approval",
        WorkflowRun.pending_node_id == pending,
    ).values(status="running").execution_options(synchronize_session=False))
    if claimed.rowcount != 1:
        await session.rollback()
        raise HTTPException(409, "Run is not awaiting approval")
    approved = body.decision == "approve"
    session.add(PolicyAudit(actor_id=str(admin.id), action="workflow_approval",
        decision=PolicyDecision.ALLOW if approved else PolicyDecision.DENY,
        reason=f"Workflow {identifier} node {pending}: {body.decision}", proposal_json="{}"))
    await session.commit()
    await session.refresh(run)
    if not approved:
        run.status, run.pending_node_id = "rejected", None
        run.node_results = [{**item, "status": "rejected"} if item["node_id"] == pending else item for item in run.node_results]
        await session.commit()
        return run
    return await execute_run(run, session, approved_node=pending)
