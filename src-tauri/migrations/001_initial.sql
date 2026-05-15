PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  folder_path TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id                 TEXT PRIMARY KEY,
  project_id         TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title              TEXT,
  active_artifact_id TEXT,
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conv_project
  ON conversations(project_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content         TEXT NOT NULL,
  metadata        TEXT,
  sequence_order  INTEGER NOT NULL,
  created_at      INTEGER NOT NULL,
  UNIQUE(conversation_id, sequence_order)
);
CREATE INDEX IF NOT EXISTS idx_msg_conv
  ON messages(conversation_id, sequence_order);

CREATE TABLE IF NOT EXISTS artifacts (
  id                  TEXT PRIMARY KEY,
  conversation_id     TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  title               TEXT,
  current_revision_id TEXT,
  file_path           TEXT,
  file_hash           TEXT,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_art_conv
  ON artifacts(conversation_id);

CREATE TABLE IF NOT EXISTS artifact_revisions (
  id          TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  message_id  TEXT REFERENCES messages(id) ON DELETE SET NULL,
  author      TEXT NOT NULL CHECK (author IN ('user', 'ai')),
  content     TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rev_artifact
  ON artifact_revisions(artifact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rev_message
  ON artifact_revisions(message_id) WHERE message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS llm_providers (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  provider_type TEXT NOT NULL,
  base_url      TEXT NOT NULL,
  api_key       TEXT,
  is_default    INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO app_settings (key, value) VALUES ('theme', '"system"');
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('approval_mode', '"manual"');
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('editor_autosave_interval_ms', '1000');
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('main_window_width', '1200');
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('main_window_height', '800');
