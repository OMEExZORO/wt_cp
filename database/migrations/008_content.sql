CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients (id) ON DELETE SET NULL,
    appointment_id UUID UNIQUE REFERENCES appointments (id) ON DELETE SET NULL,
    display_name TEXT NOT NULL,
    rating SMALLINT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    verified_visit BOOLEAN NOT NULL DEFAULT FALSE,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    moderated_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    moderated_at TIMESTAMPTZ,
    moderation_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT reviews_rating_check CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT reviews_status_check CHECK (status IN ('pending', 'approved', 'rejected')),
    CONSTRAINT reviews_display_name_length_check CHECK (char_length(display_name) BETWEEN 1 AND 80),
    CONSTRAINT reviews_body_length_check CHECK (char_length(body) BETWEEN 10 AND 2000)
);

CREATE INDEX reviews_public_idx ON reviews (status, created_at DESC);
CREATE INDEX reviews_patient_idx ON reviews (patient_id);

CREATE TRIGGER reviews_set_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE TABLE faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT faqs_category_check CHECK (category IN ('general', 'booking', 'preparation', 'reports', 'privacy')),
    CONSTRAINT faqs_question_unique UNIQUE (question)
);

CREATE INDEX faqs_published_idx ON faqs (is_published, sort_order);

CREATE TRIGGER faqs_set_updated_at BEFORE UPDATE ON faqs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

CREATE TABLE site_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    value_type TEXT NOT NULL DEFAULT 'string',
    group_name TEXT NOT NULL DEFAULT 'general',
    label TEXT NOT NULL,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    is_placeholder BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT site_settings_key_format_check CHECK (key ~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$'),
    CONSTRAINT site_settings_value_type_check CHECK (value_type IN ('string', 'text', 'url', 'phone', 'email', 'json', 'image'))
);

CREATE INDEX site_settings_group_idx ON site_settings (group_name);

CREATE TRIGGER site_settings_set_updated_at BEFORE UPDATE ON site_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
