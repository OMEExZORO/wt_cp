CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified_at TIMESTAMPTZ,
    failed_login_count INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_role_check CHECK (role IN ('patient', 'receptionist', 'doctor', 'admin', 'referrer')),
    CONSTRAINT users_email_length_check CHECK (char_length(email) BETWEEN 3 AND 254),
    CONSTRAINT users_full_name_length_check CHECK (char_length(full_name) BETWEEN 1 AND 120),
    CONSTRAINT users_failed_login_count_check CHECK (failed_login_count >= 0)
);

CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email));
CREATE INDEX users_role_idx ON users (role);

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE TABLE remember_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    selector TEXT NOT NULL UNIQUE,
    validator_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ,
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT remember_tokens_selector_length_check CHECK (char_length(selector) BETWEEN 16 AND 64)
);

CREATE INDEX remember_tokens_user_idx ON remember_tokens (user_id);
CREATE INDEX remember_tokens_expires_idx ON remember_tokens (expires_at);

CREATE TRIGGER remember_tokens_set_updated_at BEFORE UPDATE ON remember_tokens
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE remember_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    requested_ip INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX password_resets_user_idx ON password_resets (user_id);

CREATE TRIGGER password_resets_set_updated_at BEFORE UPDATE ON password_resets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;

CREATE TABLE email_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX email_verifications_user_idx ON email_verifications (user_id);

CREATE TRIGGER email_verifications_set_updated_at BEFORE UPDATE ON email_verifications
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;

CREATE TABLE login_attempts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email TEXT NOT NULL,
    ip_address INET,
    succeeded BOOLEAN NOT NULL,
    user_agent TEXT,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX login_attempts_email_time_idx ON login_attempts (lower(email), attempted_at DESC);
CREATE INDEX login_attempts_ip_time_idx ON login_attempts (ip_address, attempted_at DESC);

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
