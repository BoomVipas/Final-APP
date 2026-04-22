-- =============================================================================
-- PILLo Caregiver App — Migration 002: Row-Level Security Policies
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: get_current_caregiver_role()
-- Returns the caregiver_role enum for the currently authenticated user,
-- or NULL if the user is not in the caregivers table.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_current_caregiver_role()
RETURNS caregiver_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role
    FROM   caregivers
    WHERE  auth_user_id = auth.uid()
      AND  is_active = TRUE
    LIMIT  1;
$$;

-- ---------------------------------------------------------------------------
-- Helper: get_current_caregiver_ward()
-- Returns the ward_id for the currently authenticated caregiver.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_current_caregiver_ward()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT ward_id
    FROM   caregivers
    WHERE  auth_user_id = auth.uid()
      AND  is_active = TRUE
    LIMIT  1;
$$;

-- ---------------------------------------------------------------------------
-- Helper: get_current_caregiver_id()
-- Returns the caregivers.id UUID for the currently authenticated user.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_current_caregiver_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id
    FROM   caregivers
    WHERE  auth_user_id = auth.uid()
      AND  is_active = TRUE
    LIMIT  1;
$$;

-- =============================================================================
-- TABLE: caregivers
-- =============================================================================
ALTER TABLE caregivers ENABLE ROW LEVEL SECURITY;

-- Any authenticated caregiver can read their own row
CREATE POLICY "caregivers_select_self"
    ON caregivers FOR SELECT
    TO authenticated
    USING (auth_user_id = auth.uid());

-- Admins can read all caregiver rows in their ward
CREATE POLICY "caregivers_select_ward_admin"
    ON caregivers FOR SELECT
    TO authenticated
    USING (
        ward_id = get_current_caregiver_ward()
        AND get_current_caregiver_role() IN ('admin', 'nurse')
    );

-- Only admins can insert/update caregivers
CREATE POLICY "caregivers_insert_admin"
    ON caregivers FOR INSERT
    TO authenticated
    WITH CHECK (get_current_caregiver_role() = 'admin');

CREATE POLICY "caregivers_update_admin"
    ON caregivers FOR UPDATE
    TO authenticated
    USING  (get_current_caregiver_role() = 'admin')
    WITH CHECK (get_current_caregiver_role() = 'admin');

-- =============================================================================
-- TABLE: patients
-- =============================================================================
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Caregivers can SELECT patients in their own ward
CREATE POLICY "patients_select_own_ward"
    ON patients FOR SELECT
    TO authenticated
    USING (ward_id = get_current_caregiver_ward());

-- Only nurses and admins can INSERT patients
CREATE POLICY "patients_insert_nurse_admin"
    ON patients FOR INSERT
    TO authenticated
    WITH CHECK (get_current_caregiver_role() IN ('nurse', 'admin'));

-- Only nurses and admins can UPDATE patients
CREATE POLICY "patients_update_nurse_admin"
    ON patients FOR UPDATE
    TO authenticated
    USING  (
        ward_id = get_current_caregiver_ward()
        AND get_current_caregiver_role() IN ('nurse', 'admin')
    )
    WITH CHECK (get_current_caregiver_role() IN ('nurse', 'admin'));

-- =============================================================================
-- TABLE: medications  (drug reference catalogue — readable by all authenticated)
-- =============================================================================
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read medications
CREATE POLICY "medications_select_all_authenticated"
    ON medications FOR SELECT
    TO authenticated
    USING (TRUE);

-- Only nurses and admins can INSERT/UPDATE medications
CREATE POLICY "medications_insert_nurse_admin"
    ON medications FOR INSERT
    TO authenticated
    WITH CHECK (get_current_caregiver_role() IN ('nurse', 'admin'));

CREATE POLICY "medications_update_nurse_admin"
    ON medications FOR UPDATE
    TO authenticated
    USING  (get_current_caregiver_role() IN ('nurse', 'admin'))
    WITH CHECK (get_current_caregiver_role() IN ('nurse', 'admin'));

-- =============================================================================
-- TABLE: prescriptions
-- =============================================================================
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

-- Read: caregivers in the same ward as the patient
CREATE POLICY "prescriptions_select_own_ward"
    ON prescriptions FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM patients p
            WHERE  p.id = prescriptions.patient_id
              AND  p.ward_id = get_current_caregiver_ward()
        )
    );

-- Insert: nurses and admins only
CREATE POLICY "prescriptions_insert_nurse_admin"
    ON prescriptions FOR INSERT
    TO authenticated
    WITH CHECK (
        get_current_caregiver_role() IN ('nurse', 'admin')
        AND EXISTS (
            SELECT 1 FROM patients p
            WHERE  p.id = patient_id
              AND  p.ward_id = get_current_caregiver_ward()
        )
    );

-- Update: nurses and admins only
CREATE POLICY "prescriptions_update_nurse_admin"
    ON prescriptions FOR UPDATE
    TO authenticated
    USING  (
        get_current_caregiver_role() IN ('nurse', 'admin')
        AND EXISTS (
            SELECT 1 FROM patients p
            WHERE  p.id = prescriptions.patient_id
              AND  p.ward_id = get_current_caregiver_ward()
        )
    )
    WITH CHECK (get_current_caregiver_role() IN ('nurse', 'admin'));

-- =============================================================================
-- TABLE: medication_schedules
-- =============================================================================
ALTER TABLE medication_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medication_schedules_select_own_ward"
    ON medication_schedules FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM patients p
            WHERE  p.id = medication_schedules.patient_id
              AND  p.ward_id = get_current_caregiver_ward()
        )
    );

CREATE POLICY "medication_schedules_insert_nurse_admin"
    ON medication_schedules FOR INSERT
    TO authenticated
    WITH CHECK (
        get_current_caregiver_role() IN ('nurse', 'admin')
        AND EXISTS (
            SELECT 1 FROM patients p
            WHERE  p.id = patient_id
              AND  p.ward_id = get_current_caregiver_ward()
        )
    );

CREATE POLICY "medication_schedules_update_nurse_admin"
    ON medication_schedules FOR UPDATE
    TO authenticated
    USING  (
        get_current_caregiver_role() IN ('nurse', 'admin')
        AND EXISTS (
            SELECT 1 FROM patients p
            WHERE  p.id = medication_schedules.patient_id
              AND  p.ward_id = get_current_caregiver_ward()
        )
    )
    WITH CHECK (get_current_caregiver_role() IN ('nurse', 'admin'));

-- =============================================================================
-- TABLE: medication_logs
-- =============================================================================
ALTER TABLE medication_logs ENABLE ROW LEVEL SECURITY;

-- Read: any caregiver in the same ward
CREATE POLICY "medication_logs_select_own_ward"
    ON medication_logs FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM patients p
            WHERE  p.id = medication_logs.patient_id
              AND  p.ward_id = get_current_caregiver_ward()
        )
    );

-- Insert: any active caregiver for patients in their ward
CREATE POLICY "medication_logs_insert_own_ward"
    ON medication_logs FOR INSERT
    TO authenticated
    WITH CHECK (
        caregiver_id = get_current_caregiver_id()
        AND EXISTS (
            SELECT 1 FROM patients p
            WHERE  p.id = patient_id
              AND  p.ward_id = get_current_caregiver_ward()
        )
    );

-- Update: nurses/admins can update logs in their ward (e.g. correct an entry)
CREATE POLICY "medication_logs_update_nurse_admin"
    ON medication_logs FOR UPDATE
    TO authenticated
    USING  (
        get_current_caregiver_role() IN ('nurse', 'admin')
        AND EXISTS (
            SELECT 1 FROM patients p
            WHERE  p.id = medication_logs.patient_id
              AND  p.ward_id = get_current_caregiver_ward()
        )
    )
    WITH CHECK (get_current_caregiver_role() IN ('nurse', 'admin'));

-- =============================================================================
-- TABLE: inventory
-- =============================================================================
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_select_own_ward"
    ON inventory FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM patients p
            WHERE  p.id = inventory.patient_id
              AND  p.ward_id = get_current_caregiver_ward()
        )
    );

-- Nurses and admins can adjust inventory manually
CREATE POLICY "inventory_insert_nurse_admin"
    ON inventory FOR INSERT
    TO authenticated
    WITH CHECK (
        get_current_caregiver_role() IN ('nurse', 'admin')
        AND EXISTS (
            SELECT 1 FROM patients p
            WHERE  p.id = patient_id
              AND  p.ward_id = get_current_caregiver_ward()
        )
    );

CREATE POLICY "inventory_update_nurse_admin"
    ON inventory FOR UPDATE
    TO authenticated
    USING  (
        get_current_caregiver_role() IN ('nurse', 'admin')
        AND EXISTS (
            SELECT 1 FROM patients p
            WHERE  p.id = inventory.patient_id
              AND  p.ward_id = get_current_caregiver_ward()
        )
    )
    WITH CHECK (get_current_caregiver_role() IN ('nurse', 'admin'));

-- Service role (Edge Functions) can update inventory (for trigger-like operations)
-- This is handled implicitly: service_role bypasses RLS.

-- =============================================================================
-- TABLE: prescription_changes
-- =============================================================================
ALTER TABLE prescription_changes ENABLE ROW LEVEL SECURITY;

-- Read: caregivers in the patient's ward
CREATE POLICY "prescription_changes_select_own_ward"
    ON prescription_changes FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM   prescriptions pr
            JOIN   patients p ON p.id = pr.patient_id
            WHERE  pr.id = prescription_changes.prescription_id
              AND  p.ward_id = get_current_caregiver_ward()
        )
    );

-- Insert: nurses and admins only
CREATE POLICY "prescription_changes_insert_nurse_admin"
    ON prescription_changes FOR INSERT
    TO authenticated
    WITH CHECK (
        get_current_caregiver_role() IN ('nurse', 'admin')
        AND changed_by = get_current_caregiver_id()
    );

-- =============================================================================
-- TABLE: shift_handovers
-- =============================================================================
ALTER TABLE shift_handovers ENABLE ROW LEVEL SECURITY;

-- Read: caregivers can only read handovers for their own ward
CREATE POLICY "shift_handovers_select_own_ward"
    ON shift_handovers FOR SELECT
    TO authenticated
    USING (ward_id = get_current_caregiver_ward());

-- Insert: caregivers can create handovers for their own ward
CREATE POLICY "shift_handovers_insert_own_ward"
    ON shift_handovers FOR INSERT
    TO authenticated
    WITH CHECK (
        ward_id = get_current_caregiver_ward()
        AND caregiver_id = get_current_caregiver_id()
    );

-- Update: only the creating caregiver or nurses/admins in the ward
CREATE POLICY "shift_handovers_update_own_ward"
    ON shift_handovers FOR UPDATE
    TO authenticated
    USING (
        ward_id = get_current_caregiver_ward()
        AND (
            caregiver_id = get_current_caregiver_id()
            OR get_current_caregiver_role() IN ('nurse', 'admin')
        )
    )
    WITH CHECK (ward_id = get_current_caregiver_ward());

-- =============================================================================
-- TABLE: family_contacts
-- (private — only visible to caregivers assigned to the patient's ward)
-- =============================================================================
ALTER TABLE family_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family_contacts_select_patient_ward"
    ON family_contacts FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM patients p
            WHERE  p.id = family_contacts.patient_id
              AND  p.ward_id = get_current_caregiver_ward()
        )
    );

-- Only nurses and admins can manage family contact records
CREATE POLICY "family_contacts_insert_nurse_admin"
    ON family_contacts FOR INSERT
    TO authenticated
    WITH CHECK (
        get_current_caregiver_role() IN ('nurse', 'admin')
        AND EXISTS (
            SELECT 1 FROM patients p
            WHERE  p.id = patient_id
              AND  p.ward_id = get_current_caregiver_ward()
        )
    );

CREATE POLICY "family_contacts_update_nurse_admin"
    ON family_contacts FOR UPDATE
    TO authenticated
    USING  (
        get_current_caregiver_role() IN ('nurse', 'admin')
        AND EXISTS (
            SELECT 1 FROM patients p
            WHERE  p.id = family_contacts.patient_id
              AND  p.ward_id = get_current_caregiver_ward()
        )
    )
    WITH CHECK (get_current_caregiver_role() IN ('nurse', 'admin'));

-- =============================================================================
-- TABLE: notification_logs
-- =============================================================================
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Caregivers can read notification logs where they are the recipient
CREATE POLICY "notification_logs_select_own"
    ON notification_logs FOR SELECT
    TO authenticated
    USING (
        recipient_type = 'caregiver'
        AND recipient_id = get_current_caregiver_id()
    );

-- Only the service role (Edge Functions) can write notification_logs.
-- service_role bypasses RLS; no explicit INSERT policy needed for authenticated role.
-- Deny all direct inserts from authenticated users:
CREATE POLICY "notification_logs_insert_service_only"
    ON notification_logs FOR INSERT
    TO authenticated
    WITH CHECK (FALSE);   -- authenticated users cannot insert; only service_role can

-- =============================================================================
-- TABLE: audit_log
-- =============================================================================
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can read audit logs for their ward's activity
CREATE POLICY "audit_log_select_admin"
    ON audit_log FOR SELECT
    TO authenticated
    USING (get_current_caregiver_role() = 'admin');

-- No direct inserts from authenticated users — written only by trigger (security definer)
CREATE POLICY "audit_log_insert_deny"
    ON audit_log FOR INSERT
    TO authenticated
    WITH CHECK (FALSE);
