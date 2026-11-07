from __future__ import annotations

from collections.abc import Mapping, Sequence
from contextlib import AsyncExitStack
from dataclasses import dataclass
from types import TracebackType
from typing import Any, Self

from jsonschema import Draft202012Validator
from mcp import Client, StdioServerParameters
from mcp.types import CallToolResult, Tool
from pydantic import BaseModel, ConfigDict, Field

from app.db.models.user import UserRole
from app.policies.actions import ActionDefinition, ActionRegistry, Constraint


class McpError(RuntimeError):
    pass


class McpToolError(McpError):
    def __init__(self, tool_name: str, message: str) -> None:
        super().__init__(f"MCP tool '{tool_name}' failed: {message}")
        self.tool_name = tool_name


class McpToolProposal(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    name: str = Field(min_length=1, max_length=200)
    arguments: dict[str, Any]


@dataclass(frozen=True)
class McpServerConfig:
    name: str
    command: str
    args: tuple[str, ...]
    allowed_tools: frozenset[str]
    min_role: UserRole = UserRole.ADMIN
    env: Mapping[str, str] | None = None


@dataclass(frozen=True)
class McpToolBinding:
    action_name: str
    server_name: str
    tool_name: str


class McpToolClient:
    def __init__(self, config: McpServerConfig) -> None:
        self.config = config
        self._client: Client | None = None
        self._stack = AsyncExitStack()

    async def __aenter__(self) -> Self:
        parameters = StdioServerParameters(
            command=self.config.command,
            args=list(self.config.args),
            env=dict(self.config.env) if self.config.env is not None else None,
        )
        self._client = Client(parameters)
        await self._stack.enter_async_context(self._client)
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        await self._stack.aclose()
        self._client = None

    def _connected_client(self) -> Client:
        if self._client is None:
            raise McpError(f"MCP server '{self.config.name}' is not connected")
        return self._client

    async def discover_tools(self) -> list[Tool]:
        listing = await self._connected_client().list_tools()
        return [
            tool for tool in listing.tools if tool.name in self.config.allowed_tools
        ]

    async def call_tool(
        self,
        tool_name: str,
        arguments: Mapping[str, Any],
    ) -> dict[str, Any]:
        if tool_name not in self.config.allowed_tools:
            raise McpToolError(tool_name, "tool is not allowlisted")

        result: CallToolResult = await self._connected_client().call_tool(
            tool_name,
            dict(arguments),
        )
        text = "\n".join(block.text for block in result.content if block.type == "text")

        if result.is_error:
            raise McpToolError(tool_name, text or "unknown error")

        return {
            "text": text,
            "structured": result.structured_content,
        }


def _arguments_match_schema(input_schema: Mapping[str, Any]) -> Constraint:
    Draft202012Validator.check_schema(dict(input_schema))
    validator = Draft202012Validator(dict(input_schema))

    def constraint(proposal: BaseModel) -> bool:
        if not isinstance(proposal, McpToolProposal):
            return False
        return validator.is_valid(proposal.arguments)

    return constraint


@dataclass(frozen=True)
class McpActionCatalog:
    definitions: tuple[ActionDefinition, ...]
    bindings: Mapping[str, McpToolBinding]
    clients: Mapping[str, McpToolClient]

    def registry(self) -> ActionRegistry:
        return ActionRegistry(list(self.definitions))

    async def execute(self, proposal: McpToolProposal) -> dict[str, Any]:
        binding = self.bindings.get(proposal.name)
        if binding is None:
            raise McpError(f"No MCP binding for action: {proposal.name}")
        client = self.clients[binding.server_name]
        return await client.call_tool(binding.tool_name, proposal.arguments)


async def build_mcp_catalog(clients: Sequence[McpToolClient]) -> McpActionCatalog:
    definitions: list[ActionDefinition] = []
    bindings: dict[str, McpToolBinding] = {}
    connected: dict[str, McpToolClient] = {}

    for client in clients:
        server_name = client.config.name
        if server_name in connected:
            raise McpError(f"Duplicate MCP server name: {server_name}")
        connected[server_name] = client

        for tool in await client.discover_tools():
            action_name = f"mcp.{server_name}.{tool.name}"
            definitions.append(
                ActionDefinition(
                    name=action_name,
                    proposal_model=McpToolProposal,
                    min_role=client.config.min_role,
                    constraints=(_arguments_match_schema(tool.input_schema),),
                )
            )
            bindings[action_name] = McpToolBinding(
                action_name=action_name,
                server_name=server_name,
                tool_name=tool.name,
            )

    return McpActionCatalog(
        definitions=tuple(definitions),
        bindings=bindings,
        clients=connected,
    )
