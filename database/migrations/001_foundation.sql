CREATE TABLE IF NOT EXISTS schema_migrations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    filename TEXT NOT NULL UNIQUE,
    checksum TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION reject_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    RAISE EXCEPTION 'Table % is append-only: % is not allowed', TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$;
