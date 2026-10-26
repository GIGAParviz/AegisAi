from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from app.agents.graph import AgentGraph
from app.core.config import settings


@asynccontextmanager
async def postgres_agent_graph() -> AsyncIterator[AgentGraph]:
    database_url = settings.agent_checkpoint_url

    if not database_url:
        raise RuntimeError("AGENT_CHECKPOINT_URL is required")

    async with AsyncPostgresSaver.from_conn_string(database_url) as checkpointer:
        await checkpointer.setup()

        yield AgentGraph(
            checkpointer=checkpointer,
        )
