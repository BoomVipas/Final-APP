# PILLo App — Task List

---

## STATUS UPDATE — 2026-04-23

### Verified This Round

- [x] Duplicate tab route files removed; bottom navigation now renders only `Home`, `Ward`, and `Profile`
- [x] `app/ward/[id].tsx` renders and passes Puppeteer smoke check
- [x] `app/patient/[id].tsx` renders and passes Puppeteer smoke check
- [x] `app/(tabs)/settings.tsx` renders and passes Puppeteer smoke check
- [x] `app/edit-profile.tsx` renders and passes Puppeteer smoke check
- [x] `app/change-password.tsx` renders and passes Puppeteer smoke check
- [x] `app/preferences.tsx` renders and passes Puppeteer smoke check
- [x] `app/report.tsx` renders and passes Puppeteer smoke check
- [x] `app/add-medication.tsx` renders and passes Puppeteer smoke check
- [x] `app/notifications.tsx` renders and passes Puppeteer smoke check
- [x] TypeScript passes with `tsc --noEmit`

### Current Concerns

- `Change Password` is implemented, but real password updates are blocked while dev auth bypass is enabled.
- `Add Medication` has a real route and CTA wiring, but it is not yet a save form for `patient_prescriptions`.
- Ward `Dispense` currently supports read/filter/select UI only; it does not yet persist a confirm-dispense action.
- Patient detail `Appointments` and `Device` sections are visual scaffolds, not live integrations to `appointments` / `cabinet_slots`.
- Home `Order` currently routes to the dispensing report as a usable workflow entry point, but a dedicated ordering / refill flow still needs to be designed.
- Some ellipsis buttons now open basic workflow navigation, but they do not yet complete the full business actions described in the backlog.

---

## STATUS UPDATE — 2026-04-27

### Verified This Round

- [x] `src/lib/moonraker.ts` extended for the weekly-fill workflow: `homeAllAxes()` and `moveCabinetToFill(cabinet)` exposed; `runDispenseSequence` now accepts optional `startY` and returns the final Y so sequential dispenses can skip the ~2s G28 re-home. Backwards-compatible — existing `app/ward/[id].tsx` caller unchanged (no `startY` passed, return value ignored).
- [x] Handover preset chips in `app/handover.tsx` now toggle on/off (`togglePreset` + `selectedPresetIds` Set) — tap once to add the preset line to shift notes, tap again to remove it. Selected chips render filled-orange. "ล้าง / Clear" also resets the toggle set.
- [x] **Dev auth bypass gated behind `__DEV__`** — `src/lib/devAuth.ts` now exports `isDevAuthBypassActive = __DEV__ && AUTH_BYPASS_FLAG`; production bundles can't honor the flag even if a developer forgets to flip it. All four call sites (`authStore.signIn/signOut/initialize`, `change-password.tsx`) switched to the new export. `app/_layout.tsx` mounts a non-dismissible `<DevAuthBypassBanner />` above the Expo Router `<Stack>` while bypass is active — bilingual ("โหมดข้ามการล็อกอิน (DEV) / Auth bypass active (DEV only)"), softOrange/gentleAmber palette, SafeAreaView-aware.
- [x] **Workflow 15 A1 — Duplicate-dose confirmation modal (PDF §9)** — `medicationStore` split: new `checkDuplicate(item) → { isDuplicate, conflictingLog? }` queries last 60min of `medication_logs` for the same prescription+meal_time and feeds the existing `checkDuplicateDose` pure helper. `confirmDose(item, caregiverId, { force?, method? })` throws `Error('DUPLICATE_DOSE')` when not forced; with `force: true` it inserts and stamps `conflict_flag: true`. The `method` parameter now passes through (previously hardcoded `'normal'`). `app/(tabs)/schedule.tsx` adds `DuplicateConfirmSheet`: slide-up `Modal`, softOrange warning icon (no red per palette rule), patient + drug + "บันทึกล่าสุด HH:MM น." from `administered_at`, two full-width 48dp buttons "ยกเลิก / Cancel" and "บันทึกอยู่ดี / Log anyway". Flow: tap-confirm → method picker → on submit `checkDuplicate`; if duplicate, method sheet closes and DuplicateConfirmSheet opens; "Log anyway" calls `confirmDose` with `force:true`.
- [x] **Workflow 1 quick wins — Forgot Password + inline login error** — new `authStore.resetPassword(email)` wrapper (no-ops in dev bypass). `app/login.tsx`: right-aligned "ลืมรหัสผ่าน? / Forgot Password?" Pressable below password field (48dp `hitSlop`); empty email → inline `emailError` "กรุณากรอกอีเมลก่อน / Please enter your email first"; success → inline confirmation "ลิงก์รีเซ็ตรหัสผ่านส่งไปที่อีเมลแล้ว / Reset link sent to your email". `Alert.alert` flows replaced with `loginError` state (gentleAmber) under password field; generic Supabase "Invalid login credentials" maps to "อีเมลหรือรหัสผ่านไม่ถูกต้อง / Invalid email or password"; cleared on either field's `onChangeText`. Field labels also bilingualized.
- [x] **Workflow 18 D1 — `src/lib/dispenseFill.ts` DB helpers** — full API surface for the weekly-fill flow: `createDispenseSession`, `upsertDispenserSlot`, `confirmDispenserSlot`, `generateDispenseItems` (fans out to 7 days × N meal_times), `getDispenserSlots` (added because `app/dispense-fill/[sessionId]/run.tsx` already imports it), `getDispenseItemsByMeal`, `updateSessionStatus`. All four target tables (`dispense_sessions`, `dispense_items`, `cabinet_slots`, `dispenser_slots`) already have row types in `src/types/database.ts`. Mock-mode branch returns synthesized ids / counts and traces via `console.log('[dispenseFill mock] ...')` — moonraker.ts had no mock pattern of its own, so this introduces it.

### Current Concerns (delta)

- Weekly-fill workflow (Workflow 18 D2–D5 done) is now reachable end-to-end in mock mode via Patient detail → "Weekly Fill — load cabinet". Real-DB run blocked on the D1 schema follow-ups (`day_offset` column on `dispense_items`, unique constraint on `dispenser_slots`).
- Dispense fail mode "ไม่สามารถสร้างสรุปกะได้" on `Start Handover` (settings.tsx) swallows the underlying Supabase error; root cause likely RLS or `caregiver_id` FK on `shift_handovers` for admin role. Diagnostic step pending.
- **D1 follow-ups for the next agent picking up D2–D6**: (a) confirm a `(session_id, slot_index)` unique constraint exists on `dispenser_slots` in live Supabase — `upsertDispenserSlot` relies on it via `onConflict`; (b) `generateDispenseItems` writes a `day_offset` field on `dispense_items` but the current `DispenseItemsRow` type has no such column — either add it to the table & type or drop the field from the insert; (c) `app/dispense-fill/[patientId]/load.tsx` had pre-existing TS errors unrelated to D1 (missing moonraker exports, missing `MOCK_MEDICINES` in mocks) — needs a separate pass.
- **A1 modal language gap**: `ScheduleItem` exposes only Thai medicine names, so the duplicate confirmation renders one name + strength rather than `{th} / {en}`. If bilingual drug names are required there, the schema/select has to be widened — out of scope for A1.

---

## CRITICAL BLOCKERS (must fix before device testing)

- [ ] Fix React Fabric crash on physical device — `app/(tabs)/_layout.tsx` line 39: NativeWind `className` prop causes "expected boolean but got string" error; audit all boolean props passed as className strings and replace with explicit `style={}` where needed
- [x] Remove dev auth bypass for production — `src/lib/devAuth.ts`: gated behind `__DEV__` (new `isDevAuthBypassActive` export); `app/_layout.tsx` shows a persistent bilingual warning banner above `<Stack>` while active. See 2026-04-27 status above.

---

## 🧑 HUMAN ACTIONS REQUIRED (cannot be done by Claude)

These items block or unblock engineering tasks in Workflows 15–17 below. Cross them off as they're completed.

### Secrets & API keys (set in Supabase Function secrets, not client `.env.local`)
- [~] Set `ANTHROPIC_API_KEY` — used by `handover-generator` (PDF §10.2) and `voice-assistant` (PDF §10.3 Stage C)
  - [x] Added to project-root `.env.local` (2026-04-27) — safe, no `EXPO_PUBLIC_` prefix so it won't leak to the mobile bundle
  - [ ] Push to **Supabase Function secrets** so deployed edge functions can read it: `supabase link --project-ref <ref>` then `supabase secrets set ANTHROPIC_API_KEY=...`
  - [ ] (Optional) Copy to `supabase/functions/.env` for local `supabase functions serve` testing
- [ ] Set `OPENAI_API_KEY` server-side — used by `prescription-embedder` (`text-embedding-3-small`, PDF §10.3 vector update) and `voice-assistant` Whisper (PDF §10.3 Stage A)
- [ ] Set `ELEVENLABS_API_KEY` — voice-assistant TTS (PDF §10.3 Stage D)
- [ ] Set `ELEVENLABS_VOICE_ID_TH` and `ELEVENLABS_VOICE_ID_EN` — bilingual playback per PDF §10.3
- [ ] Confirm `LINE_CHANNEL_ACCESS_TOKEN` is present in production (already used by `line-notifier`)

### Supabase project setup (Claude can write the SQL/script — only the user can run it against prod)
- [ ] Apply migration `004_voice_assistant.sql` once authored (creates `prescription_embeddings`, `voice_conversations`, `match_prescriptions` RPC, RLS, and adds `shift_handovers.narrative_text`)
- [ ] In Supabase Dashboard → Database → Webhooks: create webhook on `patient_prescriptions` INSERT/UPDATE/DELETE → invoke `prescription-embedder` edge function (UI-only setting, not in migrations)
- [ ] Verify `pgvector` extension is enabled in the live project (CLAUDE.md notes generated migrations don't match live DB)
- [ ] Run one-time backfill script to embed all existing `patient_prescriptions` rows after the embedder is deployed

### External accounts
- [ ] Create LINE Developer sandbox account; complete `line-notifier` end-to-end test (PDF §10 says this is still untested end-to-end)
- [ ] Create ElevenLabs account; pick + listen-test Thai voice and English voice
- [ ] Confirm OpenAI billing covers Whisper + embedding traffic for the demo
- [ ] Confirm Anthropic billing covers Claude calls for handover + voice assistant

### Device & user testing (cannot run in simulator)
- [ ] Microphone permission flow on physical iOS device
- [ ] Microphone permission flow on physical Android device
- [ ] Thai-speech accuracy check on Whisper with caregiver speech samples; decide if `whisper-1` suffices or upgrade to `gpt-4o-transcribe`
- [ ] Caregiver blind test of two ElevenLabs Thai voices; pick the natural one
- [ ] Field test at Saensuk Healthcare per PDF §11 user questionnaire

### Decisions / inputs needed from the team
- [ ] Decide whether to keep dev auth bypass on while building voice + handover; recommended: keep on but gate behind `__DEV__` per existing CRITICAL BLOCKER above
- [ ] Decide whether to retire the Claude-Vision `supabase/functions/label-scanner/` (parallel to client GPT-4o) or keep it as a fallback. PDF §10.1 says GPT-4o; current client matches.
- [x] **Locate `frontend-design` skill** — found at `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/frontend-design/skills/frontend-design/SKILL.md`. Plugin is on disk but not in `installed_plugins.json` (i.e. not a callable Skill); SKILL.md is read directly when authoring UI.
- [ ] **Pick a bold aesthetic direction for PILLo** (input from team) — frontend-design SKILL.md requires committing to one direction. Constrained by PILLo's clinical-tool requirements: 48dp touch targets, Thai-primary bilingual, legibility for elderly caregivers — so "maximalist chaos" / "playful toy-like" are out of bounds. The current codebase already leans **warm autumnal / editorial-medical** (cream + burnt orange + warm brown text); a defensible choice is to refine that direction rather than start from scratch. Decide before Workflow 15 A1-UI starts.

**Art-direction continuity rule (2026-04-27):** new UI must reuse what already exists when the semantic value aligns:
  - **Palette**: tokens defined in [src/theme/typo.ts](src/theme/typo.ts) — `lightBeige #FFF5E8`, `softOrange #F2A24B`, `gentleAmber #FF6A63` (coral), `text #2E2C2A`, `text2 #97928B`, `border #EFE4D5`. Real screens lean on burnt-orange `#8E4B14` / `#C96B1A` for accents. Surfaces: `#FFFFFF` / `#FFF9F2` cream. CLAUDE.md's `#E8721A` callout is stale — trust the codebase.
  - **Typography**: use the type scale in [src/theme/typo.ts](src/theme/typo.ts), don't invent inline sizes.
  - **Icons**: prefer `/icons/` reuse. Semantic map: `HourglassIcon`→waiting, `DoubleCheckIcon`/`Tick.svg`→confirm, `PillIcon`/`Medicine.svg`→medication, `LowStockIcon`→stock alert, `HospitalIcon`/`hospital.svg`→hospital visit, `AlarmClockIcon`→reminder, `ScanMedicationIcon`→scan label, `Appointment.svg`→appointment, `Document.svg`/`Details.svg`→record, `Profile.svg`/`profile_1.svg`/`profile_2.svg`→patient, `Ward.svg`/`Wardpic.svg`→ward, `Dispense.svg`/`OrderIcon`→dispense.
- [ ] **Optional: install the `frontend-design` plugin** so it's a first-class invokable skill (rather than reading SKILL.md by path). Run from Claude Code: `/plugin` → install `frontend-design`.

---

## WORKFLOW 1 — Authentication

- [x] Add "Forgot Password" button on login screen (`app/login.tsx`) → calls new `authStore.resetPassword` wrapper around `supabase.auth.resetPasswordForEmail()`. Empty-email guard renders inline "กรุณากรอกอีเมลก่อน / Please enter your email first". Success/error rendered inline. See 2026-04-27 status above.
- [x] Show inline error message when email/password is wrong — `loginError` state replaces `Alert.alert`; generic Supabase "Invalid login credentials" mapped to "อีเมลหรือรหัสผ่านไม่ถูกต้อง / Invalid email or password"; clears on field edit.
- [ ] Role-based screen filtering — hide admin-only menu items when `user.role !== 'admin'`
- [x] Build "Edit Profile" screen (`app/edit-profile.tsx`) — update name, phone via `supabase.from('users').update()`; wire "Edit Profile" button in `settings.tsx` line 256
- [x] Build "Change Password" screen (`app/change-password.tsx`) — call `supabase.auth.updateUser({ password })`; wire menu item in `settings.tsx` line 305
  Concern: route/UI is done, but live password update is unavailable while dev auth bypass is active.

---

## WORKFLOW 2 — Home Dashboard

- [x] Wire ward filter chips (All / Ward A / Ward B) in `app/(tabs)/index.tsx` lines 505–517 — filter displayed patient cards by selected ward
- [x] Wire "View All" button (line 491 and 524) → navigate to `/notifications` or `/(tabs)/patients`
- [x] Wire "Needs Attention" card (line 453) → push to `/(tabs)/schedule`
  Concern: it routes into schedule correctly, but the pending-only prefilter is not implemented yet.
- [x] Wire notification bell (line 437) → navigate to notifications list screen
- [ ] Wire three-dot ellipsis menus on patient cards (lines 167, 224) → show action sheet (View Profile / Confirm Dose / Skip)
  Note: basic navigation actions now exist, but the full confirm/skip workflow is still missing.
- [ ] Add realtime subscription on home screen — re-fetch when `medication_logs` or `patients` change

---

## WORKFLOW 3 — Schedule & Medication Confirmation

- [ ] Save admin method to `medication_logs` — `confirmDose()` in `src/stores/medicationStore.ts` receives `method` parameter but ignores it; pass it through to the DB insert
- [ ] Add refusal reason prompt — when a caregiver taps "ปฏิเสธ/Refuse", show a reason picker (patient refused, asleep, vomiting, etc.) and save `status: 'refused'` + `refusal_reason` to log
- [ ] Add notes field in bottom sheet confirmation modal (`app/(tabs)/schedule.tsx` lines 86–104)
- [ ] Implement bulk confirm — "Confirm All Pending" button to mark all pending items in current time period
- [ ] Fix date navigation prev/next arrows — verify they update `fetchSchedule()` with correct date param

---

## WORKFLOW 4 — Ward Detail (Patients Tab)

- [x] Replace hardcoded `WARD_PATIENTS` in `app/ward/[id].tsx` — fetch from `usePatientStore()` filtered by the ward `id` param
- [x] Replace hardcoded stats (16 / 12 / 4) — derive from `patientStore.patients.length`, `medicationStore.completedCount`, `medicationStore.pendingCount`
- [x] Wire sort button (line 334) — sort patient list by name / room / urgency
- [ ] Wire three-dot ellipsis on each patient card (line 123) — action sheet (View Profile / Mark Urgent / Contact Family)
- [x] Implement "See More" pagination (line 349) — show all patients beyond initial 5

---

## WORKFLOW 5 — Ward Detail (Dispense Tab)

- [x] Replace hardcoded `DISPENSE_PATIENTS` — fetch pending dispense items for selected time slot from `dispense_sessions` / `dispense_items` tables
- [x] Wire time slot chips (Morning/Noon/Evening/Night) to actually filter the dispense patient list
- [x] Radio toggle on each patient row (line 388) should update local selected state
  Concern: there is still no `Confirm Dispense` button or write flow.
- [ ] Add "Confirm Dispense" button — create a `dispense_sessions` record and `dispense_items` records; update inventory
- [x] Expand "N People Paid" section to show the list of already-dispensed patients
- [x] Replace hardcoded `DISPENSED_COUNT = 14` with a live count from the current route data source
  Concern: count is no longer hardcoded, but it is not exposed through a shared store yet.

---

## WORKFLOW 6 — Patient Detail

- [x] Wire "+ Add Medication" button (`app/patient/[id].tsx` line 468) → push to a new `app/add-medication.tsx` screen with patient_id pre-filled
- [x] Build `app/add-medication.tsx` — form for medicine name, dose, meal times, start/end date; saves to `patient_prescriptions` table
  Note (2026-04-27): full form with medicine search picker (queries `medicines` with mock fallback), dose stepper, meal-time multi-select chips, ISO start/end date inputs (no date-picker library — text inputs with regex validation), notes. Save inserts into `patient_prescriptions`. Mock mode simulates with 600ms delay + alert. CTA disabled until medicine + ≥1 meal time + valid start_date. Verified by 10 puppeteer assertions (39/39 total in tests/visual-qa/handover-qa.mjs). Follow-up: real date picker, refresh-on-save signal back to patient detail, mock-mode in-memory persistence.
- [ ] Wire "Set Reminder" buttons (lines 183, 205) — create a local Expo notification scheduled for the next dose time
- [ ] Build Appointments tab content — fetch from a `appointments` table (or show a "link to hospital system" placeholder with real booking URL)
- [ ] Build Device tab content — show PILLo cabinet slot assignment for this patient (`cabinet_slots` table)
- [ ] Add medication discontinuation — three-dot menu on each med card → "Discontinue" → set `is_active = false` on `patient_prescriptions`
- [ ] Add medication history tab or section — list past `medication_logs` for this patient sorted by date

---

## WORKFLOW 7 — Shift Handover

- [x] Build handover generation trigger — "Start Handover" menu item in `settings.tsx` calls `useHandoverStore().startHandover` to insert a new `shift_handovers` row, then routes to `/handover`. Live mode inserts directly; mock mode injects `MOCK_HANDOVER`. Note (2026-04-27): replaces the edge-function call as a stub — wire `handover-generator/` here when AI summarization is built (Workflow 16).
- [x] Add caregiver assignment field — "Handing over to:" picker before acknowledging
  Note (2026-04-27): list of ward caregivers loaded from `users` table (mock fallback `MOCK_WARD_CAREGIVERS`); selection saved to new `shift_handovers.acknowledged_by_id` column. Requires `ALTER TABLE shift_handovers ADD COLUMN acknowledged_by_id UUID REFERENCES users(id)` on live DB.
- [x] Add shift notes text input before acknowledging
  Note (2026-04-27): multiline TextInput with character count; saved to new `shift_handovers.shift_notes` column. Requires `ALTER TABLE shift_handovers ADD COLUMN shift_notes TEXT` on live DB.
- [x] Add deferral option — per-pending-item "Defer" toggle in `HandoverSummary`; deferred keys persisted to `summary_json.deferred_item_keys` on acknowledge. Item visually changes to amber "Will carry over to next shift". Acknowledgment is no longer blocked by pending items.
- [x] Build handover history screen (`app/handover-history.tsx`) — list past acknowledged handovers for the ward
  Note (2026-04-27): pulls from `shift_handovers` where `acknowledged_at IS NOT NULL`; resolves caregiver names via `users` table; mock list `MOCK_HANDOVER_HISTORY` for offline. Linked from settings → Handover History.
- [x] Wire handover link from home screen "View Handover" if one is pending
  Note (2026-04-27): pending-handover card with orange edge strip + shift label + pending count appears at top of home below hero when `pending` is non-null; taps push to `/handover`. Implements Workflow 15 A2 + A2-UI in the same shot.

---

## WORKFLOW 8 — Drug Label Scanner

- [x] Remove hardcoded mock response in `app/scanner.tsx` lines 151–166 — replace with real call to `supabase/functions/label-scanner/` passing the base64 image
  Note (2026-04-27): scanner already uses real GPT-4o Vision via `src/lib/openai.ts` (matches PDF §10.1 spec). Stale; no change required. The `supabase/functions/label-scanner/` Claude-Vision edge function is a parallel implementation — see decision item under HUMAN ACTIONS.
- [ ] Ensure `EXPO_PUBLIC_SUPABASE_URL` and service key are available in the edge function env (check `.env.local`)
- [ ] After successful scan review, save a real `patient_prescriptions` record when user taps "Save" — require selecting a patient first
- [ ] Add patient picker step before/after scan — "Which patient is this for?" before saving
- [ ] Wire `storagePath` returned by edge function — store image URL on the prescription record
- [ ] Add barcode scanning mode (use `expo-barcode-scanner`) as fallback when camera label text is unclear

---

## WORKFLOW 9 — Stock Alerts & Inventory

- [ ] Set up a Supabase cron job (pg_cron) or DB trigger to call `supabase/functions/stock-calculator/` daily or after each `medication_logs` insert
- [x] Build "All Alerts" screen (`app/notifications.tsx`) — list all active `notification_logs` with type, patient name, days remaining; wire "View All" from home screen
  Concern: screen exists and home/profile routes are wired, but it still needs richer stock-specific actions like refill and dismiss.
- [ ] Add "Mark as Read" / dismiss action on individual alerts
- [ ] Add "Request Refill" action on Low Medication alerts — creates a `prescription_changes` record or sends a LINE message to a pharmacy contact
- [ ] Show stock level bar or days-remaining count on patient detail medication cards (wire `cabinet_slots.quantity_remaining`)

---

## WORKFLOW 10 — Notifications Screen

- [x] Create `app/notifications.tsx` — list view of `notification_logs` for this caregiver, grouped by date, with icons per event type
  Concern: screen is live and filterable, but it is not yet grouped by date and does not support mark-as-read.
- [ ] Add "Mark all as read" button → update all unread logs
- [ ] Register Expo push token on login — call `Notifications.getExpoPushTokenAsync()` and save to `users` table
- [ ] Add push notification handler in root `_layout.tsx` — route user to relevant screen on notification tap (e.g., patient detail, handover, stock alert)

---

## WORKFLOW 11 — Dispensing Report

- [x] Create `app/report.tsx` — summary of dispensing activity for current shift or date range (count confirmed/refused/skipped by patient)
- [x] Wire "Dispensing Report" menu item in `settings.tsx` line 283
- [ ] Add export/share option (PDF or CSV via `expo-sharing`)

---

## WORKFLOW 12 — LINE Family Notifications

- [ ] Build `app/family-contacts.tsx` — list and edit `family_contacts` for a patient (name, relationship, LINE User ID, quiet hours)
- [ ] Link from patient detail three-dot menu → "Manage Family Contacts"
- [ ] Add manual "Notify Family" action — send custom message via `line-notifier` function from patient detail
- [ ] Configure quiet hours UI — time range picker for `quiet_hours_start` / `quiet_hours_end`
- [ ] Test `line-notifier` function end-to-end with a real LINE Developer sandbox account

---

## WORKFLOW 13 — App Settings & Preferences

- [x] Create `app/preferences.tsx` — language toggle (Thai / English), font size, notification sound on/off
- [x] Wire "Settings" menu item in `settings.tsx` line 299
- [x] Persist preferences to AsyncStorage or `users` table

---

## WORKFLOW 14 — Supabase Integration (flip out of mock mode)

- [ ] Set `USE_MOCK = false` in `src/mocks/index.ts` and verify all stores load real data
- [ ] Add connection error handling — if Supabase returns error, show a toast/banner (not a silent fallback to mock)
- [ ] Test `patientStore.fetchPatients()` with real `ward_id` from authenticated user
- [ ] Test `medicationStore.fetchSchedule()` returns correct items for today
- [ ] Test `notificationStore.fetchNotifications()` returns real alerts
- [ ] Verify realtime subscription in `medicationStore.subscribeToRealtime()` fires correctly
- [ ] Add offline banner — detect no network and show read-only cached state

---

## WORKFLOW 15 — Mobile App Spec Alignment (PDF §9)

Tags: `[code]` Claude end-to-end · `[code+human]` Claude codes, human runs/tests/provides secret · `[human]` only human

- [x] **A1. Duplicate-dose confirmation modal** `[code]` — store split done: `checkDuplicate(item) → { isDuplicate, conflictingLog? }` + `confirmDose(item, caregiverId, { force?, method? })`. Without `force` the store throws `Error('DUPLICATE_DOSE')`; with `force:true` it inserts and stamps `conflict_flag:true`. See 2026-04-27 status above.
  - [x] **A1-UI** `[code]` — `DuplicateConfirmSheet` in [app/(tabs)/schedule.tsx](app/(tabs)/schedule.tsx): slide-up Modal, softOrange warning icon (palette rule: not red), patient + drug, "บันทึกล่าสุด HH:MM น." from `administered_at`, full-width 48dp "ยกเลิก / Cancel" + "บันทึกอยู่ดี / Log anyway" buttons.
- [x] **A2. Unacknowledged-handover card on home dashboard** `[code]` — implemented via `useHandoverStore.fetchPending(ward_id)` in `loadData`; card renders only when `pending` is non-null. Re-fetches on pull-to-refresh.
  - [x] **A2-UI** `[code]` — 6px orange edge strip, period-derived shift label, pending dose count in red, full-row tap to `/handover`.
- [ ] **A3. Patient list low-stock + fill-completion indicators** `[code]` — in [app/(tabs)/patients.tsx](app/(tabs)/patients.tsx), derive low-stock from `inventory.quantity_remaining < reorder_threshold`; render a small red dot. Schema has no `dispense_sessions` table yet, so render fill-completion as "—" with a tooltip explaining it's pending the dispense session schema (avoid silently lying).
- [ ] **A4. Manual LINE family notification from patient detail** `[code+human]` — three-dot menu item "แจ้งครอบครัว / Notify Family" in [app/patient/[id].tsx](app/patient/%5Bid%5D.tsx) opens a message composer modal. Submit posts to `supabase/functions/line-notifier/` via a new thin client at `src/lib/lineNotifier.ts`. Requires `LINE_CHANNEL_ACCESS_TOKEN` (HUMAN).
  - [ ] **A4-UI** `[code]` — patient name pinned at top, family contact picker (from `family_contacts`), text area with character count, "ส่งทาง LINE / Send via LINE" button. Toast on success/failure.
- [ ] **A5. Hospital visit reminder** `[code+human]` — new screen `app/hospital-visit.tsx`. Caregiver enters visit date + notes; on save, write a row to `notification_logs` with `event_type: 'hospital_visit_reminder'` and trigger `line-notifier`. Linked from patient detail three-dot menu.
  - [ ] **A5-UI** `[code]` — date picker (defaults to next weekday), notes textarea, "Send to family" toggle, full-width CTA "บันทึก / Save reminder".

---

## WORKFLOW 16 — AI Shift Handover Summary (PDF §10.2)

- [ ] **B1. Edge function: Claude summarization** `[code+human]` — extend [supabase/functions/handover-generator/index.ts](supabase/functions/handover-generator/index.ts) to call Anthropic SDK (`claude-sonnet-4-6`) with the structured payload as system context; output a Thai+English narrative; persist to `shift_handovers.narrative_text` (new column added in migration `004`). Requires `ANTHROPIC_API_KEY` (HUMAN).
- [ ] **B2. Render NL summary on handover screen** `[code]` — [app/handover.tsx](app/handover.tsx): display `narrative_text` above the structured pending-items list; fall back to structured view if null so the screen never breaks.
  - [ ] **B2-UI** `[code]` — soft orange tint card, paragraph rendering, optional "🔊 Read aloud" button (gated behind feature flag until ElevenLabs is wired in Workflow 17).
- [ ] **B3. "Generate Handover" trigger** `[code+human]` — header button in [app/handover.tsx](app/handover.tsx) (admin/supervisor role only) invokes the edge function with current `ward_id` and shift bounds. Loading state while Claude responds. Long-term replaced by a cron, but manual trigger unblocks demo + PDF §11 experiment.

---

## WORKFLOW 17 — AI Voice Assistant (PDF §10.3)

Each subtask is independently tagged.

### C1. Database migration
- [ ] **C1-SQL** `[code]` — author `supabase/migrations/004_voice_assistant.sql`:
  - `prescription_embeddings` (id, prescription_id, patient_id, chunk_text, metadata JSONB, embedding VECTOR(1536), is_active, created_at) + IVFFlat cosine index + composite (prescription_id, is_active) index
  - `voice_conversations` (id, caregiver_id, shift_id, transcript JSONB, created_at, updated_at)
  - `match_prescriptions(query_embedding, match_count, filter_patient_id)` RPC returning top-k active rows (PDF §10.3.2 Stage B)
  - RLS: caregivers only read embeddings for patients in their `ward_id`
  - Add `narrative_text` column to `shift_handovers` (used by Workflow 16)
- [ ] **C1-Apply** `[human]` — apply migration to live Supabase

### C2. Embedding pipeline (PDF §10.3.3 vector update strategy)
- [ ] **C2-Function** `[code]` — new edge function `supabase/functions/prescription-embedder/`. Webhook-triggered on `patient_prescriptions` insert/update/delete:
  - Mark all rows for the matching `prescription_id` `is_active = false`
  - Build chunk text: `"Patient {name} (room {room}) takes {drug_name} — {instruction}, status {status}"` (per PDF §10.3.2 chunk shape)
  - Call OpenAI `text-embedding-3-small` (1536 dim)
  - Insert new row `is_active = true`
  - On any failure, leave old rows active (soft-delete only, per PDF §10.3.3 rationale — eliminates the gap window)
- [ ] **C2-Backfill** `[code]` — `scripts/backfill_embeddings.ts` iterates active `patient_prescriptions` and seeds the table
- [ ] **C2-Webhook** `[human]` — configure Database Webhook in Supabase Dashboard pointing to the embedder
- [ ] **C2-RunBackfill** `[human]` — execute backfill script with service role key

### C3. Voice query edge function (PDF §10.3.2 Stages A–D)
- [ ] **C3-Function** `[code]` — new `supabase/functions/voice-assistant/` accepting `{ audio_base64, patient_id?, conversation_id? }`. Implements:
  - **Stage A** Whisper STT (POST audio → OpenAI Whisper → text)
  - **Stage B** Embed text via `text-embedding-3-small`; if `patient_id` is null, run a Claude one-shot to extract patient name from the transcript and resolve to `patient_id`; then call `match_prescriptions(embedding, 5, patient_id)`
  - **Stage C** Load last N turns from `voice_conversations`; build prompt with retrieved chunks; call Claude `claude-sonnet-4-6` with strict instruction to answer **only from chunks** (prevent hallucinated drugs)
  - **Stage D** POST response to ElevenLabs TTS (TH or EN voice based on detected response language); return `{ transcript, response_text, response_audio_base64, conversation_id }`
  - Append both turns to `voice_conversations.transcript`

### C4. Voice assistant screen
- [ ] **C4-Screen** `[code]` — new `app/voice-assistant.tsx` using `expo-av` for record + playback. Push-to-talk: hold the orange mic button to record, release to send. While recording shows live waveform; while server processes shows pulsing "กำลังคิด / Thinking…" dots; on response auto-plays audio AND scrolls a transcript bubble onto the screen.
- [ ] **C4-UI** `[code]` — full-screen modal with patient context chip at top (e.g. "ผู้ป่วย: คุณสมใจ"), conversation bubbles (caregiver right-aligned, assistant left-aligned with subtle audio re-play button on each), giant orange PTT mic button at bottom, ambient breathing animation while idle. If launched without a patient, top of screen prompts "ถามเกี่ยวกับผู้ป่วยคนไหน? / Which patient?".
- [ ] **C4-Entry** `[code]` — floating action button on [app/patient/[id].tsx](app/patient/%5Bid%5D.tsx) (pre-fills `patient_id`) and on [app/(tabs)/index.tsx](app/(tabs)/index.tsx) (no patient context — relies on transcript extraction in Stage B).

### C5. Permissions and platform
- [ ] **C5-Plugin** `[code]` — add `expo-av` plugin to `app.json` / `app.config.ts` with `microphonePermission: "ให้แอป PILLo เข้าถึงไมโครโฟนเพื่อถามคำถามเกี่ยวกับยา"`
- [ ] **C5-iOS** `[code]` — add `NSMicrophoneUsageDescription` to iOS config
- [ ] **C5-DeviceTest** `[human]` — physical-device test on iOS + Android for mic capture and audio playback

---

## WORKFLOW 18 — Weekly Cabinet Fill (parallel to per-meal Dispense)

**Context.** Companion web app at https://github.com/buddharaksa/final-web drives the same PILLo cabinet via Moonraker but uses a different mental model — *per-patient weekly fill* (one patient → fill all 8 cabinet slots → robot dispenses the next 7 days × 4 meals into containers) versus the mobile's *per-meal multi-patient round* on `app/ward/[id].tsx`. Both are valid; both target the same hardware contract. Goal: add the weekly-fill flow as a second, optional workflow without touching the existing Dispense tab. Caregiver picks which one to use from the patient detail screen.

**Hardware contract is shared** — `src/lib/moonraker.ts` already speaks the same gcode + cabinet positions. D0–D5 done; D6 partial (type-check passes; physical-device + Puppeteer pending).

- [x] **D0. Moonraker connection upgrade** `[code]` — `homeAllAxes()`, `moveCabinetToFill(cabinet)`, `runDispenseSequence(cabinets, onProgress, startY?)` returning final Y. See 2026-04-27 status above.
- [x] **D1. DB helpers** `[code]` — `src/lib/dispenseFill.ts` exposes `createDispenseSession`, `upsertDispenserSlot`, `confirmDispenserSlot`, `generateDispenseItems` (7×N fan-out), `getDispenserSlots` (was added by D1, dropped by a later linter pass — `run.tsx` now fetches `dispenser_slots` directly via supabase instead), `getDispenseItemsByMeal`, `updateSessionStatus`. All four target tables already typed in `src/types/database.ts`. Mock-mode branch returns synthesized values + `[dispenseFill mock]` traces. **Outstanding follow-ups**: (a) verify `(session_id, slot_index)` unique constraint on `dispenser_slots` in live DB (used by `onConflict`); (b) `generateDispenseItems` writes `day_offset` to `dispense_items` but the column is missing from both `DispenseItemsRow` and (probably) the live table — add a migration or drop the field before flipping `USE_MOCK = false`.
- [x] **D2. Workflow chooser entry** `[code]` — secondary outlined "Weekly Fill — load cabinet" CTA stacked above the unchanged "+ Add Medication" primary button in [app/patient/[id].tsx](app/patient/%5Bid%5D.tsx). Routes to `/dispense-fill/load/[patientId]`. No modal chooser; the per-meal flow on Ward → Dispense tab stays untouched.
- [x] **D3. Stage 1 — Load screen** `[code]` — [app/dispense-fill/load/[patientId].tsx](app/dispense-fill/load/%5BpatientId%5D.tsx). Fetches `patient_prescriptions` (with `medicines` join), checks machine status via `getMachineStatus()`, then `homeAllAxes()` + `moveCabinetToFill(1)`. One card per prescribed medicine in locked / active / filled state. Tap active card → `moveCabinetToFill(nextSlot)`. When all loaded → `createDispenseSession` + per-slot `upsertDispenserSlot` + `confirmDispenserSlot` + `generateDispenseItems` → `router.replace` to D4. Mock mode skips moonraker calls and uses a slice of `MOCK_MEDICINES` for prescriptions. Caps at MAX_SLOTS=8 (extra prescriptions logged in the session but not loaded).
  - [x] **D3-UI** `[code]` — orange/green/grey card states with `#`-numbered slot badge, meal-time chips, "Tap when loaded" / "Loaded" / "Locked" pill labels, top progress bar (filled count / total), machine status banner with cloud-offline / error / ready / sync tones from the existing palette.
- [x] **D4. Stage 2 — Schedule screen** `[code]` — [app/dispense-fill/run/[sessionId].tsx](app/dispense-fill/run/%5BsessionId%5D.tsx). Loads `dispenser_slots` directly via supabase. Derives `activeMeals` from the union of `meal_times` across loaded slots, builds a 7-day × N-meal cell grid in `useState`. First cell auto-runs `runDispenseSequence(indices, onProgress)` (no `startY` → homes once); subsequent cells run with `startY = lastYRef.current` to skip re-homing. "Ready for next" advances active cell; final cell calls `updateSessionStatus(id, 'completed')` then `router.replace` to D5. Live event log with emoji icons. Emergency stop calls `emergencyStop()` and marks session `failed`. Mock mode + mock session ids (`mock-session-…`) bypass moonraker and use a built-in `MOCK_SLOTS` array.
  - [x] **D4-UI** `[code]` — day tab pills with orange-dot indicator for off-screen active days, full day name with "— dispensing now" suffix, meal cards with status badges (waiting / dispensing / done), per-slot list with slot-number badge + dose count, inline "Ready for next" CTA on the active card, footer with Stop + Ready buttons.
- [x] **D5. Stage 3 — Complete screen** `[code]` — [app/dispense-fill/complete/[sessionId].tsx](app/dispense-fill/complete/%5BsessionId%5D.tsx). Reads `getDispenseItemsByMeal` per meal_time, computes Meals/Day, Total Tabs, Med Types stats. Renders "—" placeholders in mock mode. "Back to home" replaces to `/(tabs)`.
- [ ] **D6. Verification** `[code+human]` — [x] `npx tsc --noEmit` passes (verified 2026-04-27); [ ] Puppeteer smoke for the three new screens with a mock patient/session id; [ ] physical-device test against real `pillo.local:7125` (load screen should move tray slot-by-slot; run screen should home once then dispense without re-homing). The D1 schema follow-ups (day_offset, unique constraint) must land before non-mock D3 → D4 → D5 transition will work end-to-end.

### D-flow design decisions worth knowing

- **Route layout switched mid-build** from `app/dispense-fill/[patientId]/load.tsx` + `[sessionId]/run.tsx` (two different dynamic dirs at the same level — Expo Router treats them as ambiguous) to `app/dispense-fill/load/[patientId].tsx` + `run/[sessionId].tsx` + `complete/[sessionId].tsx`. Static-segment-first means each route has a unique prefix and there's no resolution gamble. All three router pathnames updated accordingly.
- **`dispenseFill.ts` was rewritten by lint passes** during D1 — the contract changed from `createDispenseSession → DispenseSessionsRow` to `→ { session_id }`, helpers absorbed `USE_MOCK` branches, the `Database` typed client was tried then reverted to the untyped shared client. The `getDispenserSlots` helper added during D1 was dropped by a later pass; `run.tsx` works around that by inlining the supabase query.
- **Two workflows now coexist on the same hardware**. Per-meal multi-patient round (Ward → Dispense tab → time slot → select patients → "Dispense for N patients") writes to `medication_logs`; per-patient weekly fill (Patient detail → Weekly Fill) writes to `dispense_sessions` + `dispenser_slots` + `dispense_items`. They share only `src/lib/moonraker.ts`.

---

## VERIFICATION (run after Workflows 15–17 are merged)

- [ ] Duplicate guard — confirm a dose, then re-confirm same prescription+meal_time within 60 min. Modal must appear; Cancel inserts nothing; "Log anyway" inserts with `conflict_flag=true`. Verify in Supabase table editor.
- [ ] Handover narrative — create a `shift_handovers` row, hit "Generate Handover", confirm Claude narrative appears in `app/handover.tsx` and is persisted to `shift_handovers.narrative_text`.
- [ ] Voice assistant happy path — physical device, patient detail → voice FAB, ask "What does {patient} take before bed?" in Thai. Verify Whisper transcript matches; server logs show `match_prescriptions` returned ≥1 active row; Claude response cites only retrieved chunks; ElevenLabs Thai audio plays back; both turns appended to `voice_conversations.transcript`.
- [ ] Vector freshness — update a `patient_prescriptions` row's instructions. Within ~5 sec confirm old `prescription_embeddings` rows have `is_active=false` and new rows have `is_active=true` with updated `chunk_text`.
- [ ] LINE manual notify — patient detail three-dot → "Notify Family" with a test message → arrives in LINE sandbox.
- [ ] Type check + smoke — `npx tsc --noEmit` passes; `npx expo start` launches; smoke each new screen via [tests/visual-qa/](tests/visual-qa/).

---

## MISSING SCREENS TO CREATE

| Screen | Route | Linked From | Status |
|--------|-------|-------------|--------|
| Notifications list | `app/notifications.tsx` | Home bell, Settings → Notifications | Created |
| Dispensing report | `app/report.tsx` | Settings → Dispensing Report | Created |
| App preferences | `app/preferences.tsx` | Settings → Settings | Created |
| Edit profile | `app/edit-profile.tsx` | Settings → Edit Profile button | Created |
| Change password | `app/change-password.tsx` | Settings → Change Password | Created |
| Add medication | `app/add-medication.tsx` | Patient Detail → + Add Medication | Created |
| Family contacts | `app/family-contacts.tsx` | Patient Detail → ⋮ menu | Missing |
| Handover history | `app/handover-history.tsx` | Home or Settings | Missing |
| Voice assistant | `app/voice-assistant.tsx` | Patient Detail FAB / Home FAB | Missing (Workflow 17 C4) |
| Hospital visit reminder | `app/hospital-visit.tsx` | Patient Detail → ⋮ menu | Missing (Workflow 15 A5) |
| Weekly fill — load | `app/dispense-fill/load/[patientId].tsx` | Patient Detail → "Weekly Fill" CTA | Created (Workflow 18 D3) |
| Weekly fill — schedule | `app/dispense-fill/run/[sessionId].tsx` | After D3 "Start Dispense" | Created (Workflow 18 D4) |
| Weekly fill — complete | `app/dispense-fill/complete/[sessionId].tsx` | After D4 final cell | Created (Workflow 18 D5) |

---

## EDGE FUNCTIONS — Wire to App

| Function | Status | Action Needed |
|----------|--------|---------------|
| `medication-engine` | Built, never called | Decide: keep store logic OR migrate to call this function; remove duplication |
| `stock-calculator` | Built, never triggered | Add pg_cron daily trigger + DB trigger on `medication_logs` insert |
| `handover-generator` | Built, never called from app | Call it from a "Generate Handover" button or auto-trigger at shift end |
| `label-scanner` | Built, app uses mock | Replace hardcoded mock in `scanner.tsx` with real function call |
| `line-notifier` | Built, called by stock-calculator only | Expose manual call from patient detail for custom family messages (Workflow 15 A4) |
| `prescription-embedder` | **Not built** | Workflow 17 C2 — webhook on `patient_prescriptions` writes; soft-delete + re-embed via OpenAI `text-embedding-3-small` |
| `voice-assistant` | **Not built** | Workflow 17 C3 — Whisper → embed → `match_prescriptions` → Claude → ElevenLabs RAG pipeline (PDF §10.3.2) |

---

## NICE TO HAVE

- [ ] Add swipe-to-confirm gesture on medication cards (swipe right = confirm, left = skip)
- [ ] Dark mode support (NativeWind `dark:` classes)
- [ ] Biometric login (Face ID / fingerprint) via `expo-local-authentication`
- [ ] Voice readout of patient name + medication via ElevenLabs TTS on dispense confirmation
- [ ] QR code per patient for quick profile lookup (generate with `react-native-qrcode-svg`)
- [ ] Offline-first: cache schedule and patient list in MMKV for no-network shifts
- [ ] Animated loading skeleton screens instead of spinner
