ALTER TABLE reports
    ADD COLUMN impression_encrypted TEXT,
    ADD COLUMN storage_driver TEXT NOT NULL DEFAULT 'supabase',
    ADD CONSTRAINT reports_storage_driver_check CHECK (storage_driver IN ('supabase', 'local'));

CREATE INDEX reports_status_idx ON reports (status) WHERE deleted_at IS NULL;
CREATE INDEX reports_created_idx ON reports (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX referrals_status_created_idx ON referrals (status, created_at DESC);
