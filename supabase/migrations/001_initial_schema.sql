-- =============================================================================
-- PILLo Caregiver App — Migration 001: Initial Schema
-- Supabase (PostgreSQL 15+)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";   -- for future AI/embedding features

-- ---------------------------------------------------------------------------
-- Enum Types
-- ---------------------------------------------------------------------------
CREATE TYPE medication_form      AS ENUM ('tablet', 'liquid', 'patch', 'injection');
CREATE TYPE time_type            AS ENUM ('meal_based', 'fixed_time');
CREATE TYPE prescription_status  AS ENUM ('active', 'discontinued', 'temporary');
CREATE TYPE priority_level       AS ENUM ('normal', 'high', 'critical');
CREATE TYPE log_status           AS ENUM ('confirmed', 'refused', 'skipped');
CREATE TYPE admin_method         AS ENUM ('normal', 'crushed', 'feeding_tube');
CREATE TYPE change_type          AS ENUM ('added', 'modified', 'discontinued');
CREATE TYPE caregiver_role       AS ENUM ('caregiver', 'nurse', 'admin');
CREATE TYPE notification_channel AS ENUM ('push', 'line');
CREATE TYPE notification_status  AS ENUM ('sent', 'delivered', 'failed');
CREATE TYPE recipient_type       AS ENUM ('caregiver', 'family');

-- ---------------------------------------------------------------------------
-- TABLE: caregivers
-- (defined before other tables that reference it)
-- ---------------------------------------------------------------------------
CREATE TABLE caregivers (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id  UUID UNIQUE NOT NULL,
    name_th       TEXT NOT NULL,
    name_en       TEXT,
    role          caregiver_role NOT NULL DEFAULT 'caregiver',
    ward_id       TEXT NOT NULL,
    phone         TEXT,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- TABLE: patients
-- ---------------------------------------------------------------------------
CREATE TABLE patients (
    id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name_th                   TEXT NOT NULL,
    name_en                   TEXT,
    room                      TEXT NOT NULL,
    bed                       TEXT NOT NULL,
    photo_url                 TEXT,
    date_of_birth             DATE NOT NULL,
    diagnoses                 TEXT[] NOT NULL DEFAULT '{}',
    allergies                 TEXT[] NOT NULL DEFAULT '{}',
    emergency_contact_line_id TEXT,
    ward_id                   TEXT NOT NULL,          -- denormalised for RLS joins
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- TABLE: medications  (drug reference catalogue)
-- ---------------------------------------------------------------------------
CREATE TABLE medications (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name_th           TEXT NOT NULL,
    name_en           TEXT NOT NULL,
    form              medication_form NOT NULL,
    default_dosage    NUMERIC(10, 3),
    unit              TEXT NOT NULL,
    notes             TEXT,
    drug_interactions TEXT[] NOT NULL DEFAULT '{}',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- TABLE: prescriptions
-- ---------------------------------------------------------------------------
CREATE TABLE prescriptions (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id           UUID NOT NULL REFERENCES patients(id)    ON DELETE CASCADE,
    medication_id        UUID NOT NULL REFERENCES medications(id)  ON DELETE RESTRICT,
    dosage               NUMERIC(10, 3) NOT NULL,
    frequency            TEXT NOT NULL,
    time_type            time_type NOT NULL DEFAULT 'fixed_time',
    time_value           TEXT NOT NULL,               -- e.g. "08:00" or "before_meal"
    start_date           DATE NOT NULL,
    end_date             DATE,
    prescribing_hospital TEXT,
    prescribing_doctor   TEXT,
    status               prescription_status NOT NULL DEFAULT 'active',
    source_image_url     TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- TABLE: medication_schedules
-- ---------------------------------------------------------------------------
CREATE TABLE medication_schedules (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prescription_id      UUID NOT NULL REFERENCES prescriptions(id)  ON DELETE CASCADE,
    patient_id           UUID NOT NULL REFERENCES patients(id)        ON DELETE CASCADE,
    medication_id        UUID NOT NULL REFERENCES medications(id)     ON DELETE RESTRICT,
    scheduled_time       TIME NOT NULL,
    time_window_minutes  INT NOT NULL DEFAULT 60,
    priority_level       priority_level NOT NULL DEFAULT 'normal',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- TABLE: medication_logs
-- ---------------------------------------------------------------------------
CREATE TABLE medication_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id     UUID NOT NULL REFERENCES medication_schedules(id) ON DELETE RESTRICT,
    caregiver_id    UUID NOT NULL REFERENCES caregivers(id)           ON DELETE RESTRICT,
    patient_id      UUID NOT NULL REFERENCES patients(id)             ON DELETE CASCADE,
    medication_id   UUID NOT NULL REFERENCES medications(id)          ON DELETE RESTRICT,
    administered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status          log_status NOT NULL,
    method          admin_method NOT NULL DEFAULT 'normal',
    refusal_reason  TEXT,
    conflict_flag   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- TABLE: inventory
-- ---------------------------------------------------------------------------
CREATE TABLE inventory (
    id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id               UUID NOT NULL REFERENCES patients(id)    ON DELETE CASCADE,
    medication_id            UUID NOT NULL REFERENCES medications(id)  ON DELETE RESTRICT,
    current_count            NUMERIC(10, 3) NOT NULL DEFAULT 0,
    daily_rate               NUMERIC(10, 3) NOT NULL DEFAULT 1,
    estimated_depletion_date DATE,
    warning_threshold        INT NOT NULL DEFAULT 7,
    critical_threshold       INT NOT NULL DEFAULT 3,
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (patient_id, medication_id)
);

-- ---------------------------------------------------------------------------
-- TABLE: prescription_changes  (audit trail for prescription edits)
-- ---------------------------------------------------------------------------
CREATE TABLE prescription_changes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    change_type     change_type NOT NULL,
    previous_json   JSONB,
    new_json        JSONB,
    changed_by      UUID NOT NULL REFERENCES caregivers(id)    ON DELETE RESTRICT,
    source_hospital TEXT,
    notified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- TABLE: shift_handovers
-- ---------------------------------------------------------------------------
CREATE TABLE shift_handovers (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ward_id        TEXT NOT NULL,
    caregiver_id   UUID NOT NULL REFERENCES caregivers(id) ON DELETE RESTRICT,
    shift_start    TIMESTAMPTZ NOT NULL,
    shift_end      TIMESTAMPTZ NOT NULL,
    summary_json   JSONB NOT NULL DEFAULT '{}',
    acknowledged_at TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- TABLE: family_contacts
-- ---------------------------------------------------------------------------
CREATE TABLE family_contacts (
    id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id               UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    name                     TEXT NOT NULL,
    line_user_id             TEXT,
    notification_preferences JSONB NOT NULL DEFAULT '{}',
    quiet_hours_start        TIME,
    quiet_hours_end          TIME,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- TABLE: notification_logs
-- ---------------------------------------------------------------------------
CREATE TABLE notification_logs (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_type recipient_type NOT NULL,
    recipient_id   UUID NOT NULL,
    channel        notification_channel NOT NULL,
    event_type     TEXT NOT NULL,
    payload        JSONB NOT NULL DEFAULT '{}',
    status         notification_status NOT NULL DEFAULT 'sent',
    sent_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- TABLE: audit_log  (populated by generic audit trigger — see 003_functions.sql)
-- ---------------------------------------------------------------------------
CREATE TABLE audit_log (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    operation  TEXT NOT NULL,           -- INSERT | UPDATE | DELETE
    old_data   JSONB,
    new_data   JSONB,
    actor_id   UUID,                    -- auth.uid() at time of operation
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Composite Indexes (query-critical paths)
-- ---------------------------------------------------------------------------
-- medication_logs: timeline queries per patient/medication
CREATE INDEX idx_medication_logs_patient_med_time
    ON medication_logs(patient_id, medication_id, administered_at DESC);

-- medication_logs: deduplication checks
CREATE INDEX idx_medication_logs_schedule_status
    ON medication_logs(schedule_id, status);

-- inventory: depletion alert scans
CREATE INDEX idx_inventory_patient_depletion
    ON inventory(patient_id, estimated_depletion_date ASC);

-- shift_handovers: ward shift lookups
CREATE INDEX idx_shift_handovers_ward_start
    ON shift_handovers(ward_id, shift_start DESC);

-- Supporting indexes
CREATE INDEX idx_prescriptions_patient       ON prescriptions(patient_id);
CREATE INDEX idx_medication_schedules_patient ON medication_schedules(patient_id);
CREATE INDEX idx_prescription_changes_prescription ON prescription_changes(prescription_id, created_at DESC);
CREATE INDEX idx_patients_ward               ON patients(ward_id);
CREATE INDEX idx_caregivers_ward             ON caregivers(ward_id);
CREATE INDEX idx_caregivers_auth_user        ON caregivers(auth_user_id);

-- ---------------------------------------------------------------------------
-- updated_at auto-maintenance function + triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_patients_updated_at
    BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_medications_updated_at
    BEFORE UPDATE ON medications
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_prescriptions_updated_at
    BEFORE UPDATE ON prescriptions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_medication_schedules_updated_at
    BEFORE UPDATE ON medication_schedules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_caregivers_updated_at
    BEFORE UPDATE ON caregivers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_inventory_updated_at
    BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Realtime publications
-- ---------------------------------------------------------------------------
-- Supabase Realtime works by adding tables to the supabase_realtime publication.
ALTER PUBLICATION supabase_realtime ADD TABLE medication_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE prescription_changes;
ALTER PUBLICATION supabase_realtime ADD TABLE inventory;
ALTER PUBLICATION supabase_realtime ADD TABLE shift_handovers;
