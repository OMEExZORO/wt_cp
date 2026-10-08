CREATE TABLE critical_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES reports (id) ON DELETE RESTRICT,
    patient_id UUID NOT NULL REFERENCES patients (id) ON DELETE RESTRICT,
    referrer_id UUID REFERENCES referrers (id) ON DELETE SET NULL,
    raised_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    finding_summary_encrypted TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    escalation_level SMALLINT NOT NULL DEFAULT 0,
    notify_count SMALLINT NOT NULL DEFAULT 0,
    last_notified_at TIMESTAMPTZ,
    next_escalation_at TIMESTAMPTZ,
    staff_flagged_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    resolved_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT critical_alerts_status_check CHECK (status IN ('open', 'notified', 'escalated', 'acknowledged', 'resolved', 'cancelled')),
    CONSTRAINT critical_alerts_escalation_level_check CHECK (escalation_level BETWEEN 0 AND 10),
    CONSTRAINT critical_alerts_notify_count_check CHECK (notify_count >= 0)
);

CREATE UNIQUE INDEX critical_alerts_one_active_per_report ON critical_alerts (report_id)
    WHERE status NOT IN ('resolved', 'cancelled');
CREATE INDEX critical_alerts_escalation_idx ON critical_alerts (status, next_escalation_at);
CREATE INDEX critical_alerts_patient_idx ON critical_alerts (patient_id);
CREATE INDEX critical_alerts_referrer_idx ON critical_alerts (referrer_id);

CREATE TRIGGER critical_alerts_set_updated_at BEFORE UPDATE ON critical_alerts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE critical_alerts ENABLE ROW LEVEL SECURITY;

CREATE TABLE alert_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    alert_id UUID NOT NULL REFERENCES critical_alerts (id) ON DELETE RESTRICT,
    event_type TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    actor_type TEXT NOT NULL,
    actor_user_id UUID REFERENCES users (id) ON DELETE RESTRICT,
    channel TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT alert_events_event_type_check CHECK (event_type IN ('raised', 'notified', 'resent', 'escalated', 'staff_flagged', 'acknowledged', 'resolved', 'cancelled', 'delivery_failed')),
    CONSTRAINT alert_events_actor_type_check CHECK (actor_type IN ('user', 'system')),
    CONSTRAINT alert_events_actor_consistency_check CHECK (actor_type = 'system' OR actor_user_id IS NOT NULL),
    CONSTRAINT alert_events_channel_check CHECK (channel IS NULL OR channel IN ('email', 'in_app', 'sms_stub', 'phone'))
);

CREATE INDEX alert_events_alert_idx ON alert_events (alert_id, created_at);

CREATE TRIGGER alert_events_reject_update BEFORE UPDATE ON alert_events
    FOR EACH ROW EXECUTE FUNCTION reject_modification();
CREATE TRIGGER alert_events_reject_delete BEFORE DELETE ON alert_events
    FOR EACH ROW EXECUTE FUNCTION reject_modification();
CREATE TRIGGER alert_events_reject_truncate BEFORE TRUNCATE ON alert_events
    FOR EACH STATEMENT EXECUTE FUNCTION reject_modification();

ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;
