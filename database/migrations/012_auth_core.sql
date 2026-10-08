ALTER TABLE users ADD COLUMN consent_given_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN consent_version TEXT;

ALTER TABLE remember_tokens ADD COLUMN previous_validator_hash TEXT;
ALTER TABLE remember_tokens ADD COLUMN rotated_at TIMESTAMPTZ;

CREATE TABLE rate_limits (
    bucket TEXT PRIMARY KEY,
    hits INTEGER NOT NULL DEFAULT 0,
    window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT rate_limits_bucket_length_check CHECK (char_length(bucket) BETWEEN 1 AND 200),
    CONSTRAINT rate_limits_hits_check CHECK (hits >= 0)
);

CREATE INDEX rate_limits_window_idx ON rate_limits (window_started_at);

CREATE TRIGGER rate_limits_set_updated_at BEFORE UPDATE ON rate_limits
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE 'REVOKE ALL ON TABLE public.rate_limits FROM anon';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE 'REVOKE ALL ON TABLE public.rate_limits FROM authenticated';
    END IF;
END;
$$;
