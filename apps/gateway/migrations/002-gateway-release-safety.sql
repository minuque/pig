ALTER TABLE sessions ADD COLUMN source_byte_size INTEGER;
ALTER TABLE sessions ADD COLUMN source_digest TEXT;
ALTER TABLE sessions ADD COLUMN verified_prefix_size INTEGER;
ALTER TABLE sessions ADD COLUMN verified_prefix_digest TEXT;
ALTER TABLE sessions ADD COLUMN projection_parser_version INTEGER;
ALTER TABLE sessions ADD COLUMN projection_generation INTEGER NOT NULL DEFAULT 0;

CREATE TABLE workspace_grants (
  principal_id TEXT NOT NULL REFERENCES principals(principal_id),
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(principal_id, workspace_id)
);

INSERT INTO workspace_grants(principal_id,workspace_id,active,created_at,updated_at)
SELECT principal_id,workspace_id,1,updated_at,updated_at FROM workspaces;
CREATE INDEX idx_workspace_grants_active ON workspace_grants(principal_id,workspace_id,active);
