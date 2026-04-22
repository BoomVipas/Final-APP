-- =============================================================================
-- PILLo Caregiver App — Migration 003: Functions & Triggers
-- =============================================================================

-- ---------------------------------------------------------------------------
-- FUNCTION: calculate_depletion_date(p_patient_id, p_medication_id)
-- Returns the projected date on which the patient's medication stock runs out.
-- Returns NULL if no inventory row exists or daily_rate is 0.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_depletion_date(
    p_patient_id    UUID,
    p_medication_id UUID
)
RETURNS DATE
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_count NUMERIC;
    v_daily_rate    NUMERIC;
BEGIN
    SELECT current_count, daily_rate
    INTO   v_current_count, v_daily_rate
    FROM   inventory
    WHERE  patient_id    = p_patient_id
      AND  medication_id = p_medication_id
    LIMIT  1;

    IF NOT FOUND OR v_daily_rate IS NULL OR v_daily_rate = 0 THEN
        RETURN NULL;
    END IF;

    RETURN CURRENT_DATE + FLOOR(v_current_count / v_daily_rate)::INT;
END;
$$;

-- ---------------------------------------------------------------------------
-- FUNCTION: check_duplicate_dose(p_schedule_id, p_time_window_minutes)
-- Returns TRUE if a confirmed medication_log already exists for the given
-- schedule within the last N minutes (default 60).  Used before logging a dose
-- to prevent accidental double-dosing.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_duplicate_dose(
    p_schedule_id        UUID,
    p_time_window_minutes INT DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM   medication_logs
        WHERE  schedule_id     = p_schedule_id
          AND  status          = 'confirmed'
          AND  administered_at >= NOW() - (p_time_window_minutes || ' minutes')::INTERVAL
    )
    INTO v_exists;

    RETURN v_exists;
END;
$$;

-- ---------------------------------------------------------------------------
-- FUNCTION: generate_handover_summary(p_ward_id, p_shift_start)
-- Returns a JSONB object summarising what the incoming shift needs to know:
--   {
--     "pending_items":        [...],  -- scheduled doses not yet logged
--     "prescription_changes": [...],  -- changes made since shift_start
--     "alerts":               [...],  -- critical/high-priority active schedules
--     "prn_medications":      [...]   -- temporary prescriptions still active
--   }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_handover_summary(
    p_ward_id    TEXT,
    p_shift_start TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pending_items        JSONB;
    v_prescription_changes JSONB;
    v_alerts               JSONB;
    v_prn_medications      JSONB;
BEGIN
    -- ----------------------------------------------------------------
    -- 1. Pending items: medication_schedules with no confirmed log today
    -- ----------------------------------------------------------------
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'schedule_id',    ms.id,
                'patient_id',     ms.patient_id,
                'patient_name_th', p.name_th,
                'room',           p.room,
                'bed',            p.bed,
                'medication_id',  ms.medication_id,
                'medication_name_th', m.name_th,
                'medication_name_en', m.name_en,
                'scheduled_time', ms.scheduled_time,
                'priority_level', ms.priority_level
            )
        ),
        '[]'::JSONB
    )
    INTO v_pending_items
    FROM   medication_schedules ms
    JOIN   patients     p ON p.id = ms.patient_id
    JOIN   medications  m ON m.id = ms.medication_id
    LEFT   JOIN medication_logs ml
               ON  ml.schedule_id = ms.id
               AND ml.status      = 'confirmed'
               AND ml.administered_at::DATE = CURRENT_DATE
    WHERE  p.ward_id = p_ward_id
      AND  ml.id IS NULL                        -- no confirmed log today
      AND  EXISTS (                             -- prescription still active
               SELECT 1 FROM prescriptions pr
               WHERE  pr.id     = ms.prescription_id
                 AND  pr.status = 'active'
           );

    -- ----------------------------------------------------------------
    -- 2. Prescription changes since shift start
    -- ----------------------------------------------------------------
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'change_id',      pc.id,
                'prescription_id', pc.prescription_id,
                'change_type',    pc.change_type,
                'patient_id',     pr.patient_id,
                'patient_name_th', p.name_th,
                'medication_id',  pr.medication_id,
                'medication_name_th', m.name_th,
                'changed_by',     pc.changed_by,
                'source_hospital', pc.source_hospital,
                'created_at',     pc.created_at
            )
            ORDER BY pc.created_at DESC
        ),
        '[]'::JSONB
    )
    INTO v_prescription_changes
    FROM   prescription_changes pc
    JOIN   prescriptions        pr ON pr.id = pc.prescription_id
    JOIN   patients             p  ON p.id  = pr.patient_id
    JOIN   medications          m  ON m.id  = pr.medication_id
    WHERE  p.ward_id    = p_ward_id
      AND  pc.created_at >= p_shift_start;

    -- ----------------------------------------------------------------
    -- 3. Active critical / high-priority alerts (unlogged critical schedules)
    -- ----------------------------------------------------------------
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'schedule_id',      ms.id,
                'patient_id',       ms.patient_id,
                'patient_name_th',  p.name_th,
                'room',             p.room,
                'bed',              p.bed,
                'medication_name_th', m.name_th,
                'scheduled_time',   ms.scheduled_time,
                'priority_level',   ms.priority_level
            )
            ORDER BY
                CASE ms.priority_level
                    WHEN 'critical' THEN 1
                    WHEN 'high'     THEN 2
                    ELSE 3
                END
        ),
        '[]'::JSONB
    )
    INTO v_alerts
    FROM   medication_schedules ms
    JOIN   patients     p ON p.id = ms.patient_id
    JOIN   medications  m ON m.id = ms.medication_id
    LEFT   JOIN medication_logs ml
               ON  ml.schedule_id = ms.id
               AND ml.administered_at::DATE = CURRENT_DATE
    WHERE  p.ward_id          = p_ward_id
      AND  ms.priority_level IN ('critical', 'high')
      AND  ml.id IS NULL;

    -- ----------------------------------------------------------------
    -- 4. PRN medications: temporary prescriptions still active
    -- ----------------------------------------------------------------
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'prescription_id',  pr.id,
                'patient_id',       pr.patient_id,
                'patient_name_th',  p.name_th,
                'room',             p.room,
                'bed',              p.bed,
                'medication_id',    pr.medication_id,
                'medication_name_th', m.name_th,
                'medication_name_en', m.name_en,
                'dosage',           pr.dosage,
                'frequency',        pr.frequency,
                'end_date',         pr.end_date
            )
            ORDER BY p.room, p.bed
        ),
        '[]'::JSONB
    )
    INTO v_prn_medications
    FROM   prescriptions pr
    JOIN   patients      p ON p.id  = pr.patient_id
    JOIN   medications   m ON m.id  = pr.medication_id
    WHERE  p.ward_id   = p_ward_id
      AND  pr.status   = 'temporary'
      AND  (pr.end_date IS NULL OR pr.end_date >= CURRENT_DATE);

    RETURN jsonb_build_object(
        'generated_at',         NOW(),
        'ward_id',              p_ward_id,
        'shift_start',          p_shift_start,
        'pending_items',        v_pending_items,
        'prescription_changes', v_prescription_changes,
        'alerts',               v_alerts,
        'prn_medications',      v_prn_medications
    );
END;
$$;

-- =============================================================================
-- TRIGGER FUNCTION: update_inventory_on_log()
-- Fires AFTER INSERT on medication_logs.
-- For confirmed logs only: decrements inventory.current_count by the prescribed
-- dosage, then refreshes estimated_depletion_date.
-- =============================================================================
CREATE OR REPLACE FUNCTION update_inventory_on_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_dosage      NUMERIC;
    v_daily_rate  NUMERIC;
    v_new_count   NUMERIC;
    v_depletion   DATE;
BEGIN
    -- Only act on confirmed administrations
    IF NEW.status <> 'confirmed' THEN
        RETURN NEW;
    END IF;

    -- Fetch prescribed dosage from the prescription linked to the schedule
    SELECT pr.dosage
    INTO   v_dosage
    FROM   medication_schedules ms
    JOIN   prescriptions pr ON pr.id = ms.prescription_id
    WHERE  ms.id = NEW.schedule_id
    LIMIT  1;

    IF v_dosage IS NULL THEN
        v_dosage := 0;
    END IF;

    -- Decrement stock (floor at 0)
    UPDATE inventory
    SET    current_count = GREATEST(current_count - v_dosage, 0),
           updated_at    = NOW()
    WHERE  patient_id    = NEW.patient_id
      AND  medication_id = NEW.medication_id
    RETURNING current_count, daily_rate
    INTO v_new_count, v_daily_rate;

    -- Recalculate depletion date
    IF v_daily_rate IS NOT NULL AND v_daily_rate > 0 THEN
        v_depletion := CURRENT_DATE + FLOOR(v_new_count / v_daily_rate)::INT;
        UPDATE inventory
        SET    estimated_depletion_date = v_depletion
        WHERE  patient_id    = NEW.patient_id
          AND  medication_id = NEW.medication_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_inventory_on_log
    AFTER INSERT ON medication_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_on_log();

-- =============================================================================
-- FUNCTION: audit_trigger()
-- Generic audit trigger.  Records INSERT/UPDATE/DELETE operations on audited
-- tables into audit_log.  actor_id is set to auth.uid() (NULL for service role).
-- =============================================================================
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO audit_log(table_name, operation, old_data, new_data, actor_id, created_at)
    VALUES (
        TG_TABLE_NAME,
        TG_OP,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        auth.uid(),
        NOW()
    );
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply audit trigger to specified tables
CREATE TRIGGER trg_audit_patients
    AFTER INSERT OR UPDATE OR DELETE ON patients
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER trg_audit_prescriptions
    AFTER INSERT OR UPDATE OR DELETE ON prescriptions
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER trg_audit_medication_logs
    AFTER INSERT OR UPDATE OR DELETE ON medication_logs
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER trg_audit_inventory
    AFTER INSERT OR UPDATE OR DELETE ON inventory
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();
