-- Tool executions table to persist tool call history
CREATE TABLE IF NOT EXISTS tool_executions (
    id TEXT PRIMARY KEY NOT NULL,
    message_id TEXT NOT NULL,
    tool_call_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    tool_source TEXT NOT NULL DEFAULT 'builtin',
    arguments TEXT NOT NULL,
    result TEXT,
    success INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    execution_order INTEGER NOT NULL DEFAULT 0,
    started_at DATETIME NOT NULL,
    completed_at DATETIME,
    FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_tool_executions_message_id ON tool_executions(message_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_tool_call_id ON tool_executions(tool_call_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_tool_name ON tool_executions(tool_name);
