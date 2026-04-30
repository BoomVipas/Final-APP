-- =============================================================================
-- PILLo — Seed cabinet_slots
-- Assigns each medicine in the medicines table a unique bay (1–8, cycling if
-- more than 8 medicines exist). Safe to re-run: ON CONFLICT DO NOTHING.
-- =============================================================================

INSERT INTO cabinet_slots (
  id,
  medicine_id,
  cabinet_position,
  quantity_remaining,
  initial_quantity,
  expiry_date,
  partition
)
SELECT
  gen_random_uuid(),
  id,
  ((ROW_NUMBER() OVER (ORDER BY name) - 1) % 8) + 1,
  100,
  100,
  CURRENT_DATE + INTERVAL '6 months',
  'A'
FROM medicines
ON CONFLICT DO NOTHING;
