CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    address_line TEXT NOT NULL,
    landmark TEXT,
    area TEXT,
    city TEXT NOT NULL DEFAULT 'Pune',
    state TEXT NOT NULL DEFAULT 'Maharashtra',
    postal_code TEXT,
    phone TEXT,
    whatsapp TEXT,
    email TEXT,
    opening_hours TEXT,
    maps_url TEXT,
    maps_embed_url TEXT,
    latitude NUMERIC(9, 6),
    longitude NUMERIC(9, 6),
    is_placeholder BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT branches_slug_format_check CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT branches_latitude_check CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CONSTRAINT branches_longitude_check CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE TRIGGER branches_set_updated_at BEFORE UPDATE ON branches
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

CREATE TABLE scan_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES scan_categories (id) ON DELETE RESTRICT,
    slug TEXT NOT NULL UNIQUE,
    modality TEXT NOT NULL,
    name TEXT NOT NULL,
    tagline TEXT,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT scan_categories_modality_check CHECK (modality IN ('USG', 'CT', 'BIOPSY')),
    CONSTRAINT scan_categories_slug_format_check CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT scan_categories_not_self_parent CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE INDEX scan_categories_parent_idx ON scan_categories (parent_id);
CREATE INDEX scan_categories_modality_idx ON scan_categories (modality);

CREATE TRIGGER scan_categories_set_updated_at BEFORE UPDATE ON scan_categories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE scan_categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE scan_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES scan_categories (id) ON DELETE RESTRICT,
    slug TEXT NOT NULL UNIQUE,
    modality TEXT NOT NULL,
    name TEXT NOT NULL,
    short_description TEXT NOT NULL,
    preparation_tips TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 20,
    fee_inr NUMERIC(10, 2),
    is_bookable_online BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT scan_types_modality_check CHECK (modality IN ('USG', 'CT', 'BIOPSY')),
    CONSTRAINT scan_types_slug_format_check CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT scan_types_duration_check CHECK (duration_minutes BETWEEN 5 AND 240),
    CONSTRAINT scan_types_fee_check CHECK (fee_inr IS NULL OR fee_inr >= 0)
);

CREATE INDEX scan_types_category_idx ON scan_types (category_id);
CREATE INDEX scan_types_modality_idx ON scan_types (modality);

CREATE TRIGGER scan_types_set_updated_at BEFORE UPDATE ON scan_types
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE scan_types ENABLE ROW LEVEL SECURITY;

CREATE TABLE checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_type_id UUID REFERENCES scan_types (id) ON DELETE CASCADE,
    modality TEXT,
    code TEXT NOT NULL UNIQUE,
    question TEXT NOT NULL,
    help_text TEXT,
    answer_type TEXT NOT NULL DEFAULT 'yes_no',
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    attention_answer TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT checklist_items_scope_check CHECK ((scan_type_id IS NULL) <> (modality IS NULL)),
    CONSTRAINT checklist_items_modality_check CHECK (modality IS NULL OR modality IN ('USG', 'CT', 'BIOPSY')),
    CONSTRAINT checklist_items_answer_type_check CHECK (answer_type IN ('yes_no', 'yes_no_unsure', 'text', 'date')),
    CONSTRAINT checklist_items_code_format_check CHECK (code ~ '^[a-z0-9]+(_[a-z0-9]+)*$')
);

CREATE INDEX checklist_items_scan_type_idx ON checklist_items (scan_type_id);
CREATE INDEX checklist_items_modality_idx ON checklist_items (modality);

CREATE TRIGGER checklist_items_set_updated_at BEFORE UPDATE ON checklist_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
