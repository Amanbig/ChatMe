-- Add 'system' role support to messages table
-- SQLite doesn't support modifying CHECK constraints, so we need to recreate the table

-- Create permission_requests table first
CREATE TABLE IF NOT EXISTS permission_requests (
    id TEXT PRIMARY KEY NOT NULL,
    chat_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    description TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('Safe', 'Moderate', 'Dangerous')),
    details TEXT, -- JSON object with operation details
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied')),
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE
);

-- Create new messages table with system role support and permission_request_id
CREATE TABLE IF NOT EXISTS messages_new (
    id TEXT PRIMARY KEY NOT NULL,
    chat_id TEXT NOT NULL,
    content TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    created_at DATETIME NOT NULL,
    images TEXT,
    permission_request_id TEXT, -- Foreign key to permission_requests table
    FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE,
    FOREIGN KEY (permission_request_id) REFERENCES permission_requests (id) ON DELETE CASCADE
);

-- Copy data from old messages table
INSERT INTO messages_new (id, chat_id, content, role, created_at, images, permission_request_id)
SELECT id, chat_id, content, role, created_at, images, NULL FROM messages;

-- Drop old messages table
DROP TABLE messages;

-- Rename new table
ALTER TABLE messages_new RENAME TO messages;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_permission_request ON messages(permission_request_id);
CREATE INDEX IF NOT EXISTS idx_permission_requests_chat_id ON permission_requests(chat_id);
CREATE INDEX IF NOT EXISTS idx_permission_requests_status ON permission_requests(status);
