CREATE TABLE audit_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    actor_role TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT audit_log_action_format_check CHECK (action ~ '^[a-z_]+(\.[a-z_]+)*$')
);

CREATE INDEX audit_log_created_idx ON audit_log (created_at DESC);
CREATE INDEX audit_log_actor_idx ON audit_log (actor_user_id, created_at DESC);
CREATE INDEX audit_log_entity_idx ON audit_log (entity_type, entity_id);
CREATE INDEX audit_log_action_idx ON audit_log (action);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
