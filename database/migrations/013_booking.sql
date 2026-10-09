ALTER TABLE appointments ADD COLUMN calendar_sequence INTEGER NOT NULL DEFAULT 0;
ALTER TABLE appointments ADD COLUMN rescheduled_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN urgency_updated_at TIMESTAMPTZ;
ALTER TABLE appointments ADD CONSTRAINT appointments_calendar_sequence_check CHECK (calendar_sequence >= 0);
ALTER TABLE appointments ADD CONSTRAINT appointments_cancellation_reason_length_check
    CHECK (cancellation_reason IS NULL OR char_length(cancellation_reason) <= 500);

CREATE INDEX appointments_branch_slot_idx ON appointments (branch_id, slot_id);
CREATE INDEX slots_branch_date_idx ON slots (branch_id, slot_date, start_time);
CREATE INDEX appointment_checklist_answers_attention_idx ON appointment_checklist_answers (appointment_id) WHERE needs_attention;
