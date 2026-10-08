CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users (id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    date_of_birth DATE,
    gender TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    consent_given_at TIMESTAMPTZ,
    consent_version TEXT,
    created_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT patients_gender_check CHECK (gender IS NULL OR gender IN ('female', 'male', 'other', 'prefer_not_to_say')),
    CONSTRAINT patients_full_name_length_check CHECK (char_length(full_name) BETWEEN 1 AND 120),
    CONSTRAINT patients_dob_check CHECK (date_of_birth IS NULL OR date_of_birth > DATE '1900-01-01')
);

CREATE INDEX patients_phone_idx ON patients (phone);
CREATE INDEX patients_email_lower_idx ON patients (lower(email));
CREATE INDEX patients_full_name_lower_idx ON patients (lower(full_name));

CREATE TRIGGER patients_set_updated_at BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

CREATE TABLE referrers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    qualification TEXT,
    registration_number TEXT,
    clinic_name TEXT,
    phone TEXT,
    city TEXT,
    verified_at TIMESTAMPTZ,
    verified_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT referrers_full_name_length_check CHECK (char_length(full_name) BETWEEN 1 AND 120)
);

CREATE TRIGGER referrers_set_updated_at BEFORE UPDATE ON referrers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE referrers ENABLE ROW LEVEL SECURITY;
