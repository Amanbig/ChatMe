-- Create api_configs table
CREATE TABLE IF NOT EXISTS api_configs (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google', 'ollama', 'custom')),
    api_key TEXT NOT NULL,
    base_url TEXT,
    model TEXT NOT NULL,
    temperature REAL NOT NULL DEFAULT 0.7,
    max_tokens INTEGER,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

-- Add api_config_id to chats table
ALTER TABLE chats ADD COLUMN api_config_id TEXT REFERENCES api_configs(id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_api_configs_provider ON api_configs(provider);
CREATE INDEX IF NOT EXISTS idx_api_configs_is_default ON api_configs(is_default);
CREATE INDEX IF NOT EXISTS idx_chats_api_config_id ON chats(api_config_id);

-- Insert default OpenAI configuration
INSERT OR IGNORE INTO api_configs (
    id, name, provider, api_key, model, temperature, is_default, created_at, updated_at
) VALUES (
    'default-openai', 
    'Default OpenAI', 
    'openai', 
    'your-api-key-here', 
    'gpt-3.5-turbo', 
    0.7, 
    TRUE, 
    datetime('now'), 
    datetime('now')
);