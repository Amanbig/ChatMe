-- Add new AI providers to the CHECK constraint
-- SQLite doesn't support ALTER TABLE to modify CHECK constraints directly
-- So we need to recreate the table with the new constraint

-- Step 1: Create new table with updated constraint
CREATE TABLE api_configs_new (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN (
        'openai',
        'anthropic',
        'google',
        'ollama',
        'mistral',
        'deepseek',
        'lmstudio',
        'kimi',
        'openrouter',
        'together',
        'groq',
        'perplexity',
        'custom'
    )),
    api_key TEXT NOT NULL,
    base_url TEXT,
    model TEXT NOT NULL,
    temperature REAL NOT NULL DEFAULT 0.7,
    max_tokens INTEGER,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

-- Step 2: Copy data from old table to new table
INSERT INTO api_configs_new
SELECT * FROM api_configs;

-- Step 3: Drop old table
DROP TABLE api_configs;

-- Step 4: Rename new table to original name
ALTER TABLE api_configs_new RENAME TO api_configs;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_api_configs_provider ON api_configs(provider);
CREATE INDEX IF NOT EXISTS idx_api_configs_is_default ON api_configs(is_default);
