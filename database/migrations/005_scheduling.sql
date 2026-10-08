CREATE TABLE slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    modality TEXT NOT NULL,
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 1,
    booked_count INTEGER NOT NULL DEFAULT 0,
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT slots_modality_check CHECK (modality IN ('USG', 'CT', 'BIOPSY')),
    CONSTRAINT slots_time_order_check CHECK (end_time > start_time),
    CONSTRAINT slots_capacity_check CHECK (capacity BETWEEN 1 AND 50),
    CONSTRAINT slots_booked_count_check CHECK (booked_count >= 0 AND booked_count <= capacity),
    CONSTRAINT slots_branch_modality_date_time_unique UNIQUE (branch_id, modality, slot_date, start_time)
);

CREATE INDEX slots_lookup_idx ON slots (modality, slot_date, branch_id);

CREATE TRIGGER slots_set_updated_at BEFORE UPDATE ON slots
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE slots ENABLE ROW LEVEL SECURITY;

CREATE TABLE referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_code TEXT NOT NULL UNIQUE,
    referrer_id UUID NOT NULL REFERENCES referrers (id) ON DELETE RESTRICT,
    patient_id UUID REFERENCES patients (id) ON DELETE SET NULL,
    patient_name TEXT NOT NULL,
    patient_phone TEXT,
    patient_email TEXT,
    scan_type_id UUID REFERENCES scan_types (id) ON DELETE SET NULL,
    preferred_branch_id UUID REFERENCES branches (id) ON DELETE SET NULL,
    urgency TEXT NOT NULL DEFAULT 'Routine',
    status TEXT NOT NULL DEFAULT 'submitted',
    clinical_notes_encrypted TEXT,
    status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT referrals_urgency_check CHECK (urgency IN ('Routine', 'Priority', 'Urgent')),
    CONSTRAINT referrals_status_check CHECK (status IN ('submitted', 'accepted', 'scheduled', 'completed', 'report_ready', 'declined', 'cancelled'))
);

CREATE INDEX referrals_referrer_idx ON referrals (referrer_id, created_at DESC);
CREATE INDEX referrals_patient_idx ON referrals (patient_id);
CREATE INDEX referrals_status_idx ON referrals (status);

CREATE TRIGGER referrals_set_updated_at BEFORE UPDATE ON referrals
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_code TEXT NOT NULL UNIQUE,
    patient_id UUID NOT NULL REFERENCES patients (id) ON DELETE RESTRICT,
    slot_id UUID NOT NULL REFERENCES slots (id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES branches (id) ON DELETE RESTRICT,
    scan_type_id UUID NOT NULL REFERENCES scan_types (id) ON DELETE RESTRICT,
    referral_id UUID REFERENCES referrals (id) ON DELETE SET NULL,
    booked_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    rescheduled_from_id UUID REFERENCES appointments (id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'confirmed',
    urgency TEXT NOT NULL DEFAULT 'Routine',
    patient_notes TEXT,
    clinical_notes_encrypted TEXT,
    consent_given_at TIMESTAMPTZ NOT NULL,
    checked_in_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    reminder_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT appointments_status_check CHECK (status IN ('pending', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show')),
    CONSTRAINT appointments_urgency_check CHECK (urgency IN ('Routine', 'Priority', 'Urgent')),
    CONSTRAINT appointments_patient_notes_length_check CHECK (patient_notes IS NULL OR char_length(patient_notes) <= 1000),
    CONSTRAINT appointments_cancel_consistency_check CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL))
);

CREATE UNIQUE INDEX appointments_patient_slot_active_unique ON appointments (patient_id, slot_id)
    WHERE status <> 'cancelled';
CREATE INDEX appointments_patient_idx ON appointments (patient_id, created_at DESC);
CREATE INDEX appointments_slot_idx ON appointments (slot_id);
CREATE INDEX appointments_branch_status_idx ON appointments (branch_id, status);
CREATE INDEX appointments_queue_idx ON appointments (status, urgency, created_at);
CREATE INDEX appointments_referral_idx ON appointments (referral_id);
CREATE INDEX appointments_reminder_idx ON appointments (reminder_sent_at) WHERE reminder_sent_at IS NULL;

CREATE TRIGGER appointments_set_updated_at BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE TABLE appointment_checklist_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments (id) ON DELETE CASCADE,
    checklist_item_id UUID NOT NULL REFERENCES checklist_items (id) ON DELETE RESTRICT,
    answer TEXT NOT NULL,
    needs_attention BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT appointment_checklist_answers_unique UNIQUE (appointment_id, checklist_item_id),
    CONSTRAINT appointment_checklist_answers_length_check CHECK (char_length(answer) <= 500)
);

CREATE INDEX appointment_checklist_answers_item_idx ON appointment_checklist_answers (checklist_item_id);

CREATE TRIGGER appointment_checklist_answers_set_updated_at BEFORE UPDATE ON appointment_checklist_answers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE appointment_checklist_answers ENABLE ROW LEVEL SECURITY;
