CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments (id) ON DELETE RESTRICT,
    patient_id UUID NOT NULL REFERENCES patients (id) ON DELETE RESTRICT,
    uploaded_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    storage_path TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    sha256 TEXT NOT NULL,
    encryption_iv TEXT NOT NULL,
    encryption_tag TEXT NOT NULL,
    key_version SMALLINT NOT NULL DEFAULT 1,
    findings_encrypted TEXT,
    status TEXT NOT NULL DEFAULT 'final',
    is_critical BOOLEAN NOT NULL DEFAULT FALSE,
    released_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT reports_mime_type_check CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png')),
    CONSTRAINT reports_size_check CHECK (size_bytes > 0 AND size_bytes <= 10485760),
    CONSTRAINT reports_status_check CHECK (status IN ('draft', 'final', 'amended')),
    CONSTRAINT reports_sha256_format_check CHECK (sha256 ~ '^[a-f0-9]{64}$'),
    CONSTRAINT reports_title_length_check CHECK (char_length(title) BETWEEN 1 AND 200)
);

CREATE INDEX reports_patient_idx ON reports (patient_id, created_at DESC);
CREATE INDEX reports_appointment_idx ON reports (appointment_id);

CREATE TRIGGER reports_set_updated_at BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE report_access_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id UUID NOT NULL REFERENCES reports (id) ON DELETE RESTRICT,
    user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT report_access_log_action_check CHECK (action IN ('upload', 'view', 'download', 'delete', 'denied'))
);

CREATE INDEX report_access_log_report_idx ON report_access_log (report_id, created_at DESC);
CREATE INDEX report_access_log_user_idx ON report_access_log (user_id, created_at DESC);

ALTER TABLE report_access_log ENABLE ROW LEVEL SECURITY;
