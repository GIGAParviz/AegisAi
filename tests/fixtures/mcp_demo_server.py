from mcp.server.mcpserver import MCPServer

server = MCPServer("demo")


@server.tool()
def add(a: int, b: int) -> int:
    return a + b


@server.tool()
def echo(text: str) -> str:
    return text


@server.tool()
def fail(reason: str) -> str:
    raise RuntimeError(reason)


if __name__ == "__main__":
    server.run()
