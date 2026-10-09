ALTER TABLE alert_events DROP CONSTRAINT alert_events_event_type_check;
ALTER TABLE alert_events ADD CONSTRAINT alert_events_event_type_check CHECK (event_type IN ('raised', 'notified', 'resent', 'escalated', 'staff_flagged', 'acknowledged', 'phone_contacted', 'resolved', 'cancelled', 'delivery_failed'));

ALTER TABLE critical_alerts ADD COLUMN resolution_note TEXT;
ALTER TABLE critical_alerts ADD CONSTRAINT critical_alerts_resolution_note_length_check CHECK (resolution_note IS NULL OR char_length(resolution_note) <= 500);

CREATE INDEX critical_alerts_staff_flagged_idx ON critical_alerts (staff_flagged_at) WHERE staff_flagged_at IS NOT NULL;
CREATE INDEX reports_critical_idx ON reports (created_at DESC) WHERE is_critical;
