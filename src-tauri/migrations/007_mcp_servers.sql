-- MCP server configurations
CREATE TABLE IF NOT EXISTS mcp_servers (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    transport_type TEXT NOT NULL CHECK (transport_type IN ('stdio', 'sse')),
    -- For stdio transport
    command TEXT,
    args TEXT,  -- JSON array of arguments
    env TEXT,   -- JSON object of environment variables
    -- For SSE transport
    url TEXT,
    headers TEXT,  -- JSON object of headers
    -- Common fields
    enabled INTEGER NOT NULL DEFAULT 1,
    auto_connect INTEGER NOT NULL DEFAULT 1,
    connection_timeout_ms INTEGER DEFAULT 30000,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

-- MCP tools discovered from servers
CREATE TABLE IF NOT EXISTS mcp_tools (
    id TEXT PRIMARY KEY NOT NULL,
    server_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    input_schema TEXT NOT NULL,  -- JSON Schema
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (server_id) REFERENCES mcp_servers (id) ON DELETE CASCADE,
    UNIQUE(server_id, name)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_mcp_servers_enabled ON mcp_servers(enabled);
CREATE INDEX IF NOT EXISTS idx_mcp_tools_server_id ON mcp_tools(server_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tools_name ON mcp_tools(name);
CREATE INDEX IF NOT EXISTS idx_mcp_tools_enabled ON mcp_tools(enabled);
