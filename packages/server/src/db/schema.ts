import type Database from 'better-sqlite3';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS projects (
    id                    TEXT PRIMARY KEY,
    name                  TEXT NOT NULL,
    root_path             TEXT NOT NULL UNIQUE,
    is_active             INTEGER NOT NULL DEFAULT 1,
    watch_ignore_patterns TEXT NOT NULL DEFAULT '[]',
    max_file_size         INTEGER NOT NULL DEFAULT 10485760,
    debounce_ms           INTEGER NOT NULL DEFAULT 500,
    auto_stop_on_critical INTEGER NOT NULL DEFAULT 1,
    snapshot_retention    INTEGER NOT NULL DEFAULT 100,
    rate_limit            INTEGER NOT NULL DEFAULT 50,
    created_at            INTEGER NOT NULL,
    updated_at            INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshots (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id),
    parent_id       TEXT REFERENCES snapshots(id),
    git_commit_hash TEXT NOT NULL,
    label           TEXT,
    file_count      INTEGER NOT NULL DEFAULT 0,
    total_size      INTEGER NOT NULL DEFAULT 0,
    is_critical     INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snapshots_project ON snapshots(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_snapshots_parent ON snapshots(parent_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_git ON snapshots(git_commit_hash);

CREATE TABLE IF NOT EXISTS action_log (
    id                TEXT PRIMARY KEY,
    sequence_number   INTEGER NOT NULL,
    project_id        TEXT NOT NULL REFERENCES projects(id),
    snapshot_id       TEXT NOT NULL REFERENCES snapshots(id),
    action            TEXT NOT NULL,
    file_path         TEXT NOT NULL,
    risk_level        TEXT NOT NULL,
    file_hash         TEXT NOT NULL,
    previous_hash     TEXT,
    diff              TEXT,
    diff_truncated    INTEGER NOT NULL DEFAULT 0,
    protection_zone   TEXT,
    risk_reasons      TEXT,
    parent_event_hash TEXT,
    is_binary         INTEGER NOT NULL DEFAULT 0,
    file_size         INTEGER,
    metadata          TEXT,
    created_at        INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_action_log_project ON action_log(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_action_log_snapshot ON action_log(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_action_log_file ON action_log(project_id, file_path);
CREATE INDEX IF NOT EXISTS idx_action_log_risk ON action_log(risk_level);
CREATE INDEX IF NOT EXISTS idx_action_log_sequence ON action_log(project_id, sequence_number);

CREATE TABLE IF NOT EXISTS protection_zones (
    id                  TEXT PRIMARY KEY,
    project_id          TEXT NOT NULL REFERENCES projects(id),
    path_pattern        TEXT NOT NULL,
    level               TEXT NOT NULL,
    reason              TEXT,
    allowed_operations  TEXT,
    is_system           INTEGER NOT NULL DEFAULT 0,
    created_by          TEXT NOT NULL DEFAULT 'operator',
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_zones_path ON protection_zones(project_id, path_pattern);

CREATE TABLE IF NOT EXISTS execution_state (
    project_id          TEXT PRIMARY KEY REFERENCES projects(id),
    state_json          TEXT NOT NULL,
    last_snapshot_id    TEXT REFERENCES snapshots(id),
    last_event_id       TEXT,
    stopped_at          INTEGER,
    error_message       TEXT,
    updated_at          INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS execution_state_history (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id),
    from_state      TEXT NOT NULL,
    to_state        TEXT NOT NULL,
    trigger_event   TEXT NOT NULL,
    triggered_by    TEXT NOT NULL,
    snapshot_id     TEXT,
    created_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_state_history_project ON execution_state_history(project_id, created_at);

CREATE TABLE IF NOT EXISTS simulator_sessions (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id),
    state_json      TEXT,
    patch_history   TEXT,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS github_analysis_cache (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id),
    repo_url        TEXT NOT NULL,
    analysis_type   TEXT NOT NULL,
    result_json     TEXT NOT NULL,
    commit_hash     TEXT NOT NULL,
    created_at      INTEGER NOT NULL,
    expires_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_github_cache_repo ON github_analysis_cache(repo_url, analysis_type);
CREATE INDEX IF NOT EXISTS idx_github_cache_expires ON github_analysis_cache(expires_at);

CREATE TABLE IF NOT EXISTS operator_sessions (
    id              TEXT PRIMARY KEY,
    client_type     TEXT NOT NULL,
    project_id      TEXT NOT NULL REFERENCES projects(id),
    connected_at    INTEGER NOT NULL,
    disconnected_at INTEGER,
    commands_sent   INTEGER NOT NULL DEFAULT 0,
    last_active_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_project ON operator_sessions(project_id, connected_at);

CREATE TABLE IF NOT EXISTS sequence_counter (
    project_id  TEXT PRIMARY KEY REFERENCES projects(id),
    last_value  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ai_behavior_scores (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id),
    window_start    INTEGER NOT NULL,
    window_end      INTEGER NOT NULL,
    total_actions   INTEGER NOT NULL DEFAULT 0,
    risk_score      REAL NOT NULL DEFAULT 0,
    velocity_score  REAL NOT NULL DEFAULT 0,
    compliance_score REAL NOT NULL DEFAULT 0,
    overall_score   REAL NOT NULL DEFAULT 0,
    details         TEXT,
    created_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_behavior_scores_project ON ai_behavior_scores(project_id, window_start);

CREATE TABLE IF NOT EXISTS prompt_versions (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id),
    version         INTEGER NOT NULL,
    name            TEXT NOT NULL,
    content         TEXT NOT NULL,
    hash            TEXT NOT NULL,
    parent_id       TEXT REFERENCES prompt_versions(id),
    is_active       INTEGER NOT NULL DEFAULT 0,
    created_by      TEXT NOT NULL DEFAULT 'operator',
    created_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_project ON prompt_versions(project_id, version);
CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_versions_active ON prompt_versions(project_id) WHERE is_active = 1;

CREATE TABLE IF NOT EXISTS agent_sessions (
    id                TEXT PRIMARY KEY,
    project_id        TEXT NOT NULL REFERENCES projects(id),
    session_id        TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'IDLE',
    model             TEXT NOT NULL,
    prompt            TEXT NOT NULL,
    target_dir        TEXT NOT NULL,
    pid               INTEGER,
    exit_code         INTEGER,
    input_tokens      INTEGER NOT NULL DEFAULT 0,
    output_tokens     INTEGER NOT NULL DEFAULT 0,
    injection_count   INTEGER NOT NULL DEFAULT 0,
    last_error        TEXT,
    started_at        INTEGER NOT NULL,
    paused_at         INTEGER,
    completed_at      INTEGER
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_project ON agent_sessions(project_id, started_at);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status);

CREATE TABLE IF NOT EXISTS agent_prompt_injections (
    id                    TEXT PRIMARY KEY,
    session_id            TEXT NOT NULL,
    project_id            TEXT NOT NULL REFERENCES projects(id),
    prompt                TEXT NOT NULL,
    context_file          TEXT,
    context_line_start    INTEGER,
    context_line_end      INTEGER,
    constraints           TEXT,
    urgency               TEXT NOT NULL DEFAULT 'normal',
    injected_at           INTEGER NOT NULL,
    agent_status_before   TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_injections_session ON agent_prompt_injections(session_id);

CREATE TABLE IF NOT EXISTS agent_breadcrumbs (
    id              TEXT PRIMARY KEY,
    session_id      TEXT NOT NULL,
    project_id      TEXT NOT NULL REFERENCES projects(id),
    file_path       TEXT NOT NULL,
    activity        TEXT NOT NULL,
    tool_name       TEXT,
    duration_ms     INTEGER,
    line_start      INTEGER,
    line_end        INTEGER,
    content_snippet TEXT,
    edit_diff       TEXT,
    timestamp       INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_breadcrumbs_session ON agent_breadcrumbs(session_id, timestamp);

CREATE TABLE IF NOT EXISTS agent_checkpoints (
    id                TEXT PRIMARY KEY,
    session_id        TEXT NOT NULL,
    project_id        TEXT NOT NULL REFERENCES projects(id),
    breadcrumbs_json  TEXT NOT NULL,
    plan_json         TEXT,
    location_json     TEXT,
    token_usage_json  TEXT,
    created_at        INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_checkpoints_session ON agent_checkpoints(session_id);

CREATE TABLE IF NOT EXISTS agent_plans (
    id              TEXT PRIMARY KEY,
    session_id      TEXT NOT NULL,
    project_id      TEXT NOT NULL REFERENCES projects(id),
    summary         TEXT NOT NULL,
    steps_json      TEXT NOT NULL,
    current_step    INTEGER NOT NULL DEFAULT 0,
    total_steps     INTEGER NOT NULL DEFAULT 0,
    confidence      REAL NOT NULL DEFAULT 0,
    extracted_at    INTEGER NOT NULL,
    superseded_at   INTEGER
);

CREATE INDEX IF NOT EXISTS idx_agent_plans_session ON agent_plans(session_id);

CREATE TABLE IF NOT EXISTS simulator_constraints (
    id                TEXT PRIMARY KEY,
    session_id        TEXT NOT NULL,
    project_id        TEXT NOT NULL REFERENCES projects(id),
    constraint_type   TEXT NOT NULL,
    selector          TEXT,
    property          TEXT,
    value             TEXT,
    image_url         TEXT,
    description       TEXT NOT NULL,
    applied_at        INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_simulator_constraints_session ON simulator_constraints(session_id);

CREATE TABLE IF NOT EXISTS replay_journal (
    id                    TEXT PRIMARY KEY,
    client_id             TEXT NOT NULL,
    project_id            TEXT NOT NULL,
    last_sequence_number  INTEGER NOT NULL,
    events_replayed       INTEGER NOT NULL DEFAULT 0,
    replay_started_at     INTEGER NOT NULL,
    replay_completed_at   INTEGER,
    created_at            INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_replay_journal_client ON replay_journal(client_id);

CREATE TABLE IF NOT EXISTS project_rules (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES projects(id),
    content     TEXT NOT NULL DEFAULT '',
    is_active   INTEGER NOT NULL DEFAULT 1,
    updated_at  INTEGER NOT NULL,
    created_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_rules_project ON project_rules(project_id);

CREATE TABLE IF NOT EXISTS file_uploads (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id),
    filename        TEXT NOT NULL,
    mime_type       TEXT NOT NULL,
    size            INTEGER NOT NULL,
    storage_path    TEXT NOT NULL,
    url             TEXT NOT NULL,
    uploaded_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_file_uploads_project ON file_uploads(project_id, uploaded_at DESC);

CREATE TABLE IF NOT EXISTS project_memory (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES projects(id),
    category    TEXT NOT NULL DEFAULT 'general',
    title       TEXT NOT NULL,
    content     TEXT NOT NULL,
    pinned      INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_project_memory_project ON project_memory(project_id, pinned DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS smart_setup_runs (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id),
    status          TEXT NOT NULL DEFAULT 'analyzing',
    profile_json    TEXT,
    discoveries_json TEXT DEFAULT '[]',
    applied_count   INTEGER NOT NULL DEFAULT 0,
    error           TEXT,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_smart_setup_project ON smart_setup_runs(project_id, created_at);

CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    username        TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'admin',
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
`;

const TRIGGERS_SQL = `
CREATE TRIGGER IF NOT EXISTS prevent_action_log_update
    BEFORE UPDATE ON action_log
    BEGIN
        SELECT RAISE(ABORT, 'action_log is append-only');
    END;

CREATE TRIGGER IF NOT EXISTS prevent_action_log_delete
    BEFORE DELETE ON action_log
    BEGIN
        SELECT RAISE(ABORT, 'action_log is append-only');
    END;

CREATE TRIGGER IF NOT EXISTS prevent_system_zone_delete
    BEFORE DELETE ON protection_zones
    WHEN OLD.is_system = 1
    BEGIN
        SELECT RAISE(ABORT, 'system protection zones cannot be deleted');
    END;
`;

/**
 * Run migrations to add columns/tables that may be missing from older DB versions.
 * Each migration is idempotent (uses IF NOT EXISTS / checks for column existence).
 */
function runMigrations(db: Database.Database): void {
  // Helper: check if a column exists in a table
  const hasColumn = (table: string, column: string): boolean => {
    const info = db.pragma(`table_info(${table})`) as Array<{ name: string }>;
    return info.some((col) => col.name === column);
  };

  // Phase 1: Add new columns to agent_breadcrumbs
  if (!hasColumn('agent_breadcrumbs', 'line_start')) {
    db.exec('ALTER TABLE agent_breadcrumbs ADD COLUMN line_start INTEGER');
  }
  if (!hasColumn('agent_breadcrumbs', 'line_end')) {
    db.exec('ALTER TABLE agent_breadcrumbs ADD COLUMN line_end INTEGER');
  }
  if (!hasColumn('agent_breadcrumbs', 'content_snippet')) {
    db.exec('ALTER TABLE agent_breadcrumbs ADD COLUMN content_snippet TEXT');
  }
  if (!hasColumn('agent_breadcrumbs', 'edit_diff')) {
    db.exec('ALTER TABLE agent_breadcrumbs ADD COLUMN edit_diff TEXT');
  }

  // Phase 4: agent_checkpoints table
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_checkpoints (
      id                TEXT PRIMARY KEY,
      session_id        TEXT NOT NULL,
      project_id        TEXT NOT NULL REFERENCES projects(id),
      breadcrumbs_json  TEXT NOT NULL,
      plan_json         TEXT,
      location_json     TEXT,
      token_usage_json  TEXT,
      created_at        INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_agent_checkpoints_session ON agent_checkpoints(session_id);
  `);
}

export function createSchema(db: Database.Database): void {
  db.exec(SCHEMA_SQL);
  db.exec(TRIGGERS_SQL);
  runMigrations(db);
}
