# PILLo Database Schema Documentation

**Version**: 1.0
**Owner**: System Architect / Database Dev
**PRD Reference**: Mobile_App_PRD.docx — DB Schema section

---

## Table of Contents

1. [Enumerations](#1-enumerations)
2. [Tables](#2-tables)
3. [Indexes](#3-indexes)
4. [RLS Policies](#4-rls-policies)
5. [DB Functions](#5-db-functions)
6. [Realtime Publications](#6-realtime-publications)

---

## 1. Enumerations

```sql
CREATE TYPE med_form AS ENUM (
  'tablet', 'capsule', 'liquid', 'injection',
  'patch', 'inhaler', 'drops', 'cream', 'suppository', 'powder'
);

CREATE TYPE time_type AS ENUM (
  'before_meal', 'after_meal', 'with_meal', 'fixed', 'as_needed'
);

CREATE TYPE log_status AS ENUM (
  'administered', 'missed', 'refused', 'held', 'partial', 'duplicate_prevented'
);

CREATE TYPE log_method AS ENUM (
  'manual', 'iot_dispenser', 'scanner', 'voice_confirm'
);

CREATE TYPE change_type AS ENUM (
  'new', 'dose_change', 'frequency_change', 'discontinue',
  'hold', 'resume', 'route_change'
);

CREATE TYPE notification_channel AS ENUM (
  'push', 'line', 'sms', 'in_app'
);

CREATE TYPE notification_status AS ENUM (
  'pending', 'sent', 'delivered', 'failed', 'read'
);

CREATE TYPE caregiver_role AS ENUM (
  'nurse', 'nursing_aide', 'pharmacist', 'supervisor', 'admin'
);

CREATE TYPE prescription_status AS ENUM (
  'active', 'on_hold', 'discontinued', 'completed', 'pending'
);

CREATE TYPE meal_period AS ENUM (
  'morning', 'noon', 'evening', 'bedtime', 'fixed', 'as_needed'
);
```

---

## 2. Tables

### 2.1 `caregivers`

Stores caregiver accounts, roles, and notification tokens. Linked to Supabase `auth.users`.

```sql
CREATE TABLE caregivers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id       UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id        TEXT NOT NULL UNIQUE,
  name_th            TEXT NOT NULL,
  name_en            TEXT,
  role               caregiver_role NOT NULL,
  ward_ids           UUID[] NOT NULL DEFAULT '{}',
  license_number     TEXT,
  phone              TEXT,
  line_user_id       TEXT,
  expo_push_token    TEXT,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

| Column | Type | Nullable | Constraint |
|:-------|:-----|:---------|:-----------|
| `id` | UUID | NO | PK, default gen_random_uuid() |
| `auth_user_id` | UUID | NO | UNIQUE, FK auth.users(id) ON DELETE CASCADE |
| `employee_id` | TEXT | NO | UNIQUE |
| `name_th` | TEXT | NO | — |
| `name_en` | TEXT | YES | — |
| `role` | caregiver_role | NO | — |
| `ward_ids` | UUID[] | NO | DEFAULT '{}' |
| `license_number` | TEXT | YES | — |
| `phone` | TEXT | YES | — |
| `line_user_id` | TEXT | YES | — |
| `expo_push_token` | TEXT | YES | — |
| `is_active` | BOOLEAN | NO | DEFAULT TRUE |
| `created_at` | TIMESTAMPTZ | NO | DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NO | DEFAULT now() |

---

### 2.2 `patients`

Core patient records. Ward assignment drives all RLS access control.

```sql
CREATE TABLE patients (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hn                  TEXT NOT NULL UNIQUE,
  name_th             TEXT NOT NULL,
  name_en             TEXT,
  date_of_birth       DATE NOT NULL,
  gender              TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  ward_id             UUID NOT NULL,
  bed_number          TEXT,
  weight_kg           NUMERIC(5,2),
  height_cm           NUMERIC(5,2),
  allergies           TEXT[] NOT NULL DEFAULT '{}',
  medical_conditions  TEXT[] NOT NULL DEFAULT '{}',
  photo_url           TEXT,
  qr_code             TEXT UNIQUE,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

| Column | Type | Nullable | Constraint |
|:-------|:-----|:---------|:-----------|
| `id` | UUID | NO | PK |
| `hn` | TEXT | NO | UNIQUE (Hospital Number) |
| `name_th` | TEXT | NO | — |
| `name_en` | TEXT | YES | — |
| `date_of_birth` | DATE | NO | — |
| `gender` | TEXT | NO | CHECK IN ('male','female','other') |
| `ward_id` | UUID | NO | FK → wards.id (conceptual) |
| `bed_number` | TEXT | YES | — |
| `weight_kg` | NUMERIC(5,2) | YES | — |
| `height_cm` | NUMERIC(5,2) | YES | — |
| `allergies` | TEXT[] | NO | DEFAULT '{}' |
| `medical_conditions` | TEXT[] | NO | DEFAULT '{}' |
| `photo_url` | TEXT | YES | — |
| `qr_code` | TEXT | YES | UNIQUE |
| `is_active` | BOOLEAN | NO | DEFAULT TRUE |

---

### 2.3 `medications`

Medication catalog. Shared across all patients. Barcode and pgvector fields support F-6 label scanner.

```sql
CREATE TABLE medications (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_th                 TEXT NOT NULL,
  name_en                 TEXT NOT NULL,
  generic_name            TEXT,
  trade_name              TEXT,
  form                    med_form NOT NULL,
  strength                TEXT NOT NULL,
  unit                    TEXT NOT NULL,
  drug_code               TEXT UNIQUE,
  barcode                 TEXT UNIQUE,
  atc_code                TEXT,
  storage_instructions    TEXT,
  special_instructions    TEXT,
  image_url               TEXT,
  name_embedding          VECTOR(1536),   -- pgvector for similarity search (F-6)
  is_prn                  BOOLEAN NOT NULL DEFAULT FALSE,
  is_controlled           BOOLEAN NOT NULL DEFAULT FALSE,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

| Column | Type | Nullable | Constraint |
|:-------|:-----|:---------|:-----------|
| `id` | UUID | NO | PK |
| `name_th` | TEXT | NO | — |
| `name_en` | TEXT | NO | — |
| `generic_name` | TEXT | YES | — |
| `trade_name` | TEXT | YES | — |
| `form` | med_form | NO | — |
| `strength` | TEXT | NO | e.g. "500mg" |
| `unit` | TEXT | NO | e.g. "tablet" |
| `drug_code` | TEXT | YES | UNIQUE (Thai FDA code) |
| `barcode` | TEXT | YES | UNIQUE |
| `atc_code` | TEXT | YES | WHO ATC classification |
| `name_embedding` | VECTOR(1536) | YES | pgvector for F-6 scanner matching |
| `is_prn` | BOOLEAN | NO | DEFAULT FALSE |
| `is_controlled` | BOOLEAN | NO | DEFAULT FALSE |

---

### 2.4 `prescriptions`

Doctor-issued medication orders. Linked to label scan artifacts for F-6.

```sql
CREATE TABLE prescriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id          UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  medication_id       UUID NOT NULL REFERENCES medications(id),
  prescribed_by       TEXT NOT NULL,
  status              prescription_status NOT NULL DEFAULT 'active',
  dose_quantity       NUMERIC(8,3) NOT NULL CHECK (dose_quantity > 0),
  dose_unit           TEXT NOT NULL,
  route               TEXT NOT NULL,
  frequency_per_day   SMALLINT NOT NULL CHECK (frequency_per_day > 0),
  instructions        TEXT,
  start_date          DATE NOT NULL,
  end_date            DATE,
  scanned_label_url   TEXT,
  scan_confidence     NUMERIC(4,3) CHECK (scan_confidence BETWEEN 0 AND 1),
  created_by          UUID NOT NULL REFERENCES caregivers(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_end_before_start CHECK (end_date IS NULL OR end_date >= start_date)
);
```

| Column | Type | Nullable | Constraint |
|:-------|:-----|:---------|:-----------|
| `id` | UUID | NO | PK |
| `patient_id` | UUID | NO | FK → patients(id) ON DELETE CASCADE |
| `medication_id` | UUID | NO | FK → medications(id) |
| `status` | prescription_status | NO | DEFAULT 'active' |
| `dose_quantity` | NUMERIC(8,3) | NO | CHECK > 0 |
| `frequency_per_day` | SMALLINT | NO | CHECK > 0 |
| `scan_confidence` | NUMERIC(4,3) | YES | CHECK BETWEEN 0 AND 1 |
| `end_date` | DATE | YES | CHECK >= start_date |

---

### 2.5 `medication_schedules`

Individual dose slots derived from prescriptions. Denormalized `patient_id` and `medication_id` for query performance.

```sql
CREATE TABLE medication_schedules (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id         UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  patient_id              UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  medication_id           UUID NOT NULL REFERENCES medications(id),
  time_type               time_type NOT NULL,
  meal_period             meal_period,
  scheduled_time          TIME,   -- HH:MM for fixed-time slots
  dose_quantity           NUMERIC(8,3) NOT NULL CHECK (dose_quantity > 0),
  dose_unit               TEXT NOT NULL,
  window_before_minutes   SMALLINT NOT NULL DEFAULT 30,
  window_after_minutes    SMALLINT NOT NULL DEFAULT 60,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT meal_period_required CHECK (
    (time_type IN ('before_meal','after_meal','with_meal') AND meal_period IS NOT NULL)
    OR time_type NOT IN ('before_meal','after_meal','with_meal')
  )
);
```

| Column | Type | Nullable | Constraint |
|:-------|:-----|:---------|:-----------|
| `prescription_id` | UUID | NO | FK → prescriptions(id) ON DELETE CASCADE |
| `patient_id` | UUID | NO | Denormalized FK → patients(id) |
| `medication_id` | UUID | NO | Denormalized FK → medications(id) |
| `time_type` | time_type | NO | — |
| `meal_period` | meal_period | YES | Required when time_type is meal-relative |
| `scheduled_time` | TIME | YES | Required when time_type = 'fixed' |
| `window_before_minutes` | SMALLINT | NO | DEFAULT 30 |
| `window_after_minutes` | SMALLINT | NO | DEFAULT 60 |

---

### 2.6 `medication_logs`

Immutable administration audit log. Core table for F-2 compliance and duplicate prevention.

```sql
CREATE TABLE medication_logs (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id                 UUID NOT NULL REFERENCES medication_schedules(id),
  patient_id                  UUID NOT NULL REFERENCES patients(id),
  medication_id               UUID NOT NULL REFERENCES medications(id),
  caregiver_id                UUID NOT NULL REFERENCES caregivers(id),
  status                      log_status NOT NULL,
  method                      log_method NOT NULL,
  administered_at             TIMESTAMPTZ NOT NULL,
  scheduled_at                TIMESTAMPTZ NOT NULL,
  dose_given                  NUMERIC(8,3),
  dose_unit                   TEXT,
  notes                       TEXT,
  photo_url                   TEXT,
  iot_device_id               TEXT,
  is_duplicate_check_passed   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Note: `medication_logs` is append-only. No UPDATE operations are permitted on this table (enforced by RLS — no UPDATE policy defined).

---

### 2.7 `inventory`

Per-patient medication stock. Tracks current count and thresholds for F-3 alerts.

```sql
CREATE TABLE inventory (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id                UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  medication_id             UUID NOT NULL REFERENCES medications(id),
  prescription_id           UUID REFERENCES prescriptions(id),
  current_count             NUMERIC(10,3) NOT NULL CHECK (current_count >= 0),
  unit                      TEXT NOT NULL,
  reorder_threshold         NUMERIC(10,3) NOT NULL DEFAULT 14,
  critical_threshold        NUMERIC(10,3) NOT NULL DEFAULT 7,
  last_restocked_at         TIMESTAMPTZ,
  restocked_by              UUID REFERENCES caregivers(id),
  estimated_depletion_date  DATE,
  batch_number              TEXT,
  expiry_date               DATE,
  storage_location          TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_patient_medication UNIQUE (patient_id, medication_id),
  CONSTRAINT reorder_above_critical CHECK (reorder_threshold >= critical_threshold)
);
```

| Column | Type | Nullable | Constraint |
|:-------|:-----|:---------|:-----------|
| `current_count` | NUMERIC(10,3) | NO | CHECK >= 0 |
| `reorder_threshold` | NUMERIC(10,3) | NO | DEFAULT 14 (days) |
| `critical_threshold` | NUMERIC(10,3) | NO | DEFAULT 7 (days) |
| `(patient_id, medication_id)` | — | — | UNIQUE constraint |

---

### 2.8 `prescription_changes`

Audit trail of all prescription modifications. Supports F-5 change notifications and F-1 handover display.

```sql
CREATE TABLE prescription_changes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id     UUID NOT NULL REFERENCES prescriptions(id),
  patient_id          UUID NOT NULL REFERENCES patients(id),
  medication_id       UUID NOT NULL REFERENCES medications(id),
  change_type         change_type NOT NULL,
  changed_by          UUID NOT NULL REFERENCES caregivers(id),
  previous_value      JSONB,
  new_value           JSONB,
  reason              TEXT,
  effective_date      DATE NOT NULL,
  acknowledged_by     UUID[],
  acknowledged_at     TIMESTAMPTZ,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### 2.9 `shift_handovers`

Shift handover records generated by `handover-generator`. Incoming caregiver must acknowledge. PRD F-1.

```sql
CREATE TABLE shift_handovers (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_id                   UUID NOT NULL,
  shift_date                DATE NOT NULL,
  shift_type                TEXT NOT NULL CHECK (shift_type IN ('morning','afternoon','night')),
  outgoing_caregiver_id     UUID NOT NULL REFERENCES caregivers(id),
  incoming_caregiver_id     UUID REFERENCES caregivers(id),
  summary_json              JSONB NOT NULL DEFAULT '{}',
  pending_medications       UUID[] NOT NULL DEFAULT '{}',
  prescription_changes      UUID[] NOT NULL DEFAULT '{}',
  active_alerts             TEXT[] NOT NULL DEFAULT '{}',
  prn_medications           UUID[] NOT NULL DEFAULT '{}',
  acknowledged              BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_at           TIMESTAMPTZ,
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_ward_shift UNIQUE (ward_id, shift_date, shift_type)
);
```

---

### 2.10 `family_contacts`

Family members who receive LINE notifications (F-7). Granular per-event opt-in flags.

```sql
CREATE TABLE family_contacts (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id                      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  name_th                         TEXT NOT NULL,
  name_en                         TEXT,
  relationship                    TEXT NOT NULL,
  phone                           TEXT,
  line_user_id                    TEXT,
  notify_on_administration        BOOLEAN NOT NULL DEFAULT FALSE,
  notify_on_missed_dose           BOOLEAN NOT NULL DEFAULT TRUE,
  notify_on_prescription_change   BOOLEAN NOT NULL DEFAULT TRUE,
  notify_on_stock_alert           BOOLEAN NOT NULL DEFAULT FALSE,
  preferred_channel               notification_channel NOT NULL DEFAULT 'line',
  is_primary_contact              BOOLEAN NOT NULL DEFAULT FALSE,
  is_active                       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### 2.11 `notification_logs`

Delivery audit log for all outbound notifications across all channels.

```sql
CREATE TABLE notification_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel               notification_channel NOT NULL,
  status                notification_status NOT NULL DEFAULT 'pending',
  recipient_type        TEXT NOT NULL CHECK (recipient_type IN ('caregiver','family_contact')),
  recipient_id          UUID NOT NULL,
  patient_id            UUID REFERENCES patients(id),
  subject               TEXT,
  body                  TEXT NOT NULL,
  payload               JSONB,
  external_message_id   TEXT,
  error_message         TEXT,
  sent_at               TIMESTAMPTZ,
  delivered_at          TIMESTAMPTZ,
  read_at               TIMESTAMPTZ,
  retry_count           SMALLINT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 3. Indexes

### 3.1 Primary & Unique (auto-created)
All PK columns have btree indexes. All UNIQUE constraints create indexes.

### 3.2 Hot Query Path Indexes

These support the most frequent queries: schedule-by-patient, logs-by-time-window, inventory lookups.

```sql
-- medication_schedules: get all active schedules for a patient (F-2, F-4)
CREATE INDEX idx_schedules_patient_active
  ON medication_schedules (patient_id, is_active)
  WHERE is_active = TRUE;

-- medication_schedules: get by prescription (cascade deactivation)
CREATE INDEX idx_schedules_prescription
  ON medication_schedules (prescription_id);

-- medication_logs: anti-duplicate check (patient + medication + time window)
-- Hot path: check_duplicate_dose function
CREATE INDEX idx_logs_schedule_time
  ON medication_logs (schedule_id, administered_at DESC);

-- medication_logs: patient administration history (F-4)
CREATE INDEX idx_logs_patient_time
  ON medication_logs (patient_id, administered_at DESC);

-- medication_logs: caregiver activity log
CREATE INDEX idx_logs_caregiver_time
  ON medication_logs (caregiver_id, administered_at DESC);

-- medication_logs: today's logs for a ward (Dashboard F-2)
-- Composite: patient + scheduled_at for time-window range queries
CREATE INDEX idx_logs_patient_scheduled
  ON medication_logs (patient_id, scheduled_at DESC);

-- inventory: per-patient stock lookup (F-3)
CREATE INDEX idx_inventory_patient
  ON inventory (patient_id);

-- inventory: below-threshold alerts (stock-calculator cron)
CREATE INDEX idx_inventory_depletion
  ON inventory (estimated_depletion_date)
  WHERE estimated_depletion_date IS NOT NULL;

-- prescription_changes: changes for a patient (F-5, F-1 handover)
CREATE INDEX idx_prescription_changes_patient_date
  ON prescription_changes (patient_id, effective_date DESC);

-- prescription_changes: unacknowledged changes
CREATE INDEX idx_prescription_changes_unacknowledged
  ON prescription_changes (patient_id, created_at DESC)
  WHERE acknowledged_at IS NULL;

-- shift_handovers: open handovers for a ward (F-1)
CREATE INDEX idx_handovers_ward_unacknowledged
  ON shift_handovers (ward_id, shift_date DESC)
  WHERE acknowledged = FALSE;

-- notification_logs: failed notifications for retry
CREATE INDEX idx_notification_logs_failed
  ON notification_logs (status, retry_count)
  WHERE status = 'failed' AND retry_count < 3;

-- patients: by ward (most common filter)
CREATE INDEX idx_patients_ward_active
  ON patients (ward_id, is_active)
  WHERE is_active = TRUE;

-- medications: pgvector similarity search (F-6 label scanner)
CREATE INDEX idx_medications_name_embedding
  ON medications USING ivfflat (name_embedding vector_cosine_ops)
  WITH (lists = 100);

-- medications: barcode lookup (F-6 scanner)
CREATE INDEX idx_medications_barcode
  ON medications (barcode)
  WHERE barcode IS NOT NULL;
```

---

## 4. RLS Policies

Row Level Security is enabled on all tables. The guiding principle: **a caregiver can only access data for patients in their assigned wards**.

### Helper Function

```sql
-- Returns true if the requesting caregiver is assigned to the given ward
CREATE OR REPLACE FUNCTION caregiver_in_ward(p_ward_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM caregivers
    WHERE auth_user_id = auth.uid()
      AND p_ward_id = ANY(ward_ids)
      AND is_active = TRUE
  );
$$;

-- Returns array of ward_ids for the requesting caregiver
CREATE OR REPLACE FUNCTION my_ward_ids()
RETURNS UUID[]
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT ward_ids FROM caregivers
  WHERE auth_user_id = auth.uid() AND is_active = TRUE
  LIMIT 1;
$$;
```

### Policy Descriptions

#### `caregivers`
| Operation | Policy | Description |
|:----------|:-------|:------------|
| SELECT | `caregivers_read_own` | Can read own row only: `auth_user_id = auth.uid()` |
| UPDATE | `caregivers_update_own` | Can update own push token and LINE ID |
| SELECT | `caregivers_read_ward_mates` | Can read caregivers who share at least one ward (for handover display) |

#### `patients`
| Operation | Policy | Description |
|:----------|:-------|:------------|
| SELECT | `patients_ward_access` | `caregiver_in_ward(ward_id) = TRUE` |
| INSERT | `patients_admin_insert` | Role = 'supervisor' or 'admin' only |
| UPDATE | `patients_admin_update` | Role = 'supervisor', 'admin', or 'pharmacist' |

#### `medications`
| Operation | Policy | Description |
|:----------|:-------|:------------|
| SELECT | `medications_any_caregiver` | Any active caregiver can read all medications (shared catalog) |
| INSERT | `medications_pharmacist_insert` | Role = 'pharmacist' or 'admin' only |
| UPDATE | `medications_pharmacist_update` | Role = 'pharmacist' or 'admin' only |

#### `prescriptions`
| Operation | Policy | Description |
|:----------|:-------|:------------|
| SELECT | `prescriptions_ward_access` | Via join to patients: `caregiver_in_ward(patients.ward_id)` |
| INSERT | `prescriptions_pharmacist_insert` | Role IN ('pharmacist', 'supervisor', 'admin') |
| UPDATE | `prescriptions_pharmacist_update` | Role IN ('pharmacist', 'supervisor', 'admin') |

#### `medication_schedules`
| Operation | Policy | Description |
|:----------|:-------|:------------|
| SELECT | `schedules_ward_access` | `patient_id IN (patients in caregiver's ward)` |
| INSERT | `schedules_pharmacist_insert` | Pharmacist / admin only |
| UPDATE | `schedules_pharmacist_update` | Pharmacist / admin only |

#### `medication_logs`
| Operation | Policy | Description |
|:----------|:-------|:------------|
| SELECT | `logs_ward_access` | `patient_id IN (patients in caregiver's ward)` |
| INSERT | `logs_caregiver_insert` | Any caregiver in the patient's ward; `caregiver_id = auth.uid()` resolved internally |
| UPDATE | _(no policy — append-only)_ | No updates allowed; logs are immutable |
| DELETE | _(no policy)_ | No deletes allowed |

#### `inventory`
| Operation | Policy | Description |
|:----------|:-------|:------------|
| SELECT | `inventory_ward_access` | `patient_id IN (patients in caregiver's ward)` |
| UPDATE | `inventory_caregiver_update` | Caregivers in ward can update `current_count` (restock) |
| INSERT | `inventory_admin_insert` | Admin / pharmacist only (initial setup) |

#### `prescription_changes`
| Operation | Policy | Description |
|:----------|:-------|:------------|
| SELECT | `changes_ward_access` | `patient_id IN (patients in caregiver's ward)` |
| INSERT | `changes_pharmacist_insert` | Pharmacist / admin only |
| UPDATE | `changes_acknowledge` | Any caregiver in ward can add their ID to `acknowledged_by` array |

#### `shift_handovers`
| Operation | Policy | Description |
|:----------|:-------|:------------|
| SELECT | `handovers_ward_access` | `caregiver_in_ward(ward_id)` |
| INSERT | `handovers_caregiver_insert` | `outgoing_caregiver_id` must equal requesting caregiver's ID |
| UPDATE | `handovers_acknowledge` | Incoming caregiver can set `acknowledged = TRUE` and `acknowledged_at` |

#### `family_contacts`
| Operation | Policy | Description |
|:----------|:-------|:------------|
| SELECT | `family_ward_access` | `patient_id IN (patients in caregiver's ward)` |
| INSERT | `family_admin_insert` | Admin / supervisor only |
| UPDATE | `family_admin_update` | Admin / supervisor only |

#### `notification_logs`
| Operation | Policy | Description |
|:----------|:-------|:------------|
| SELECT | `notif_caregiver_own` | `recipient_type = 'caregiver' AND recipient_id = (caregiver.id for auth.uid())` |
| SELECT | `notif_ward_patient` | `patient_id IN (patients in caregiver's ward)` |
| INSERT | _(service role only)_ | Edge Functions use service role key |
| UPDATE | _(service role only)_ | Delivery receipt updates from Edge Functions |

---

## 5. DB Functions

### 5.1 `calculate_depletion_date`

**Signature:**
```sql
CREATE OR REPLACE FUNCTION calculate_depletion_date(
  p_patient_id    UUID,
  p_medication_id UUID
)
RETURNS DATE
LANGUAGE plpgsql STABLE
AS $$
```

**Logic:**
1. Queries `inventory` for `current_count` and `unit` where `patient_id = p_patient_id AND medication_id = p_medication_id`.
2. Queries `medication_schedules` for all active schedules for this patient+medication.
3. Calculates `daily_dose = SUM(dose_quantity * frequency_within_day)` across all active schedules.
4. If `daily_dose = 0` → returns NULL (no active schedules).
5. Returns `CURRENT_DATE + INTERVAL '1 day' * (current_count / daily_dose)`.
6. Called by `stock-calculator` Edge Function and by `medication-engine` after each administration.

**Example:**
```
current_count = 28 tablets
daily_dose = 4 tablets/day (2 tablets x 2 times/day)
Result = CURRENT_DATE + 7 days
```

---

### 5.2 `check_duplicate_dose`

**Signature:**
```sql
CREATE OR REPLACE FUNCTION check_duplicate_dose(
  p_schedule_id         UUID,
  p_time_window_minutes INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE
AS $$
```

**Logic:**
1. Calculates the time window: `window_start = now() - (p_time_window_minutes / 2)::interval`, `window_end = now() + (p_time_window_minutes / 2)::interval`.
   - More precisely: uses `window_before_minutes` and `window_after_minutes` from the schedule row for asymmetric windows.
2. Queries `medication_logs` for any row where:
   - `schedule_id = p_schedule_id`
   - `status IN ('administered', 'partial')`
   - `administered_at BETWEEN window_start AND window_end`
3. Returns `TRUE` if such a row exists (duplicate found), `FALSE` otherwise.
4. This function is called with `SECURITY DEFINER` inside `medication-engine` Edge Function, which uses the service role.

---

### 5.3 `generate_handover_summary`

**Signature:**
```sql
CREATE OR REPLACE FUNCTION generate_handover_summary(
  p_ward_id     UUID,
  p_shift_start TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql STABLE
AS $$
```

**Logic:**
1. Determines shift end time: `p_shift_start + INTERVAL '8 hours'` (8-hour shifts).
2. Collects **pending medications**: `medication_schedules` for patients in `p_ward_id` where:
   - No `medication_logs` row exists with `status = 'administered'` for this schedule within the shift window.
   - `is_active = TRUE`.
3. Collects **prescription changes**: `prescription_changes` where:
   - `patient_id IN (ward patients)`.
   - `effective_date >= p_shift_start::date`.
4. Collects **active alerts**: `inventory` rows where `current_count <= reorder_threshold`.
5. Collects **PRN medications**: `medication_logs` where:
   - `patient_id IN (ward patients)`.
   - `administered_at BETWEEN p_shift_start AND now()`.
   - Schedule's `time_type = 'as_needed'`.
6. Returns a JSONB object matching `HandoverSummary` shape.

---

## 6. Realtime Publications

Supabase Realtime uses PostgreSQL logical replication. The following tables are added to the `supabase_realtime` publication:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE medication_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE inventory;
ALTER PUBLICATION supabase_realtime ADD TABLE prescription_changes;
ALTER PUBLICATION supabase_realtime ADD TABLE shift_handovers;
ALTER PUBLICATION supabase_realtime ADD TABLE patients;
```

Tables **not** in the publication (too low frequency or irrelevant for real-time UI):
- `medications` — catalog changes, no real-time needed.
- `caregivers` — fetched at login only.
- `prescriptions` — changes surfaced via `prescription_changes` table.
- `medication_schedules` — updated rarely; re-fetched after prescription change event.
- `notification_logs` — delivery receipts not needed on device.
- `family_contacts` — admin-managed, no real-time.

### Row Filters (per channel)

All Realtime channels in the app use row filters to receive only relevant ward data:

```
medication_logs:      patient_id=in.(patient1_id,patient2_id,...)
inventory:            patient_id=in.(patient1_id,patient2_id,...)
prescription_changes: patient_id=in.(patient1_id,patient2_id,...)
shift_handovers:      ward_id=eq.{wardId}
patients:             ward_id=eq.{wardId}
```

Patient ID lists are derived from the caregiver's `ward_ids` and resolved once at subscription time. If ward assignment changes, the app re-subscribes.
