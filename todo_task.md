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

## CRITICAL BLOCKERS (must fix before device testing)

- [ ] Fix React Fabric crash on physical device — `app/(tabs)/_layout.tsx` line 39: NativeWind `className` prop causes "expected boolean but got string" error; audit all boolean props passed as className strings and replace with explicit `style={}` where needed
- [ ] Remove dev auth bypass for production — `src/lib/devAuth.ts`: `AUTH_BYPASS_ENABLED` hardcodes a fake session; gate it behind `__DEV__` only and warn visibly in UI

---

## WORKFLOW 1 — Authentication

- [ ] Add "Forgot Password" button on login screen (`app/login.tsx`) → call `supabase.auth.resetPasswordForEmail()`
- [ ] Show inline error message when email/password is wrong (currently may show no feedback)
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
- [ ] Build `app/add-medication.tsx` — form for medicine name, dose, meal times, start/end date; saves to `patient_prescriptions` table
- [ ] Wire "Set Reminder" buttons (lines 183, 205) — create a local Expo notification scheduled for the next dose time
- [ ] Build Appointments tab content — fetch from a `appointments` table (or show a "link to hospital system" placeholder with real booking URL)
- [ ] Build Device tab content — show PILLo cabinet slot assignment for this patient (`cabinet_slots` table)
- [ ] Add medication discontinuation — three-dot menu on each med card → "Discontinue" → set `is_active = false` on `patient_prescriptions`
- [ ] Add medication history tab or section — list past `medication_logs` for this patient sorted by date

---

## WORKFLOW 7 — Shift Handover

- [ ] Build handover generation trigger — add a "Start Handover" button (in home screen header or settings) that calls `supabase/functions/handover-generator/` with current `ward_id` and shift times
- [ ] Add caregiver assignment field — "Handing over to:" picker before acknowledging
- [ ] Add shift notes text input before acknowledging
- [ ] Add deferral option — "Defer to next shift" marks item with a flag instead of blocking acknowledgment
- [ ] Build handover history screen (`app/handover-history.tsx`) — list past acknowledged handovers for the ward
- [ ] Wire handover link from home screen "View Handover" if one is pending

---

## WORKFLOW 8 — Drug Label Scanner

- [ ] Remove hardcoded mock response in `app/scanner.tsx` lines 151–166 — replace with real call to `supabase/functions/label-scanner/` passing the base64 image
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

---

## EDGE FUNCTIONS — Wire to App

| Function | Status | Action Needed |
|----------|--------|---------------|
| `medication-engine` | Built, never called | Decide: keep store logic OR migrate to call this function; remove duplication |
| `stock-calculator` | Built, never triggered | Add pg_cron daily trigger + DB trigger on `medication_logs` insert |
| `handover-generator` | Built, never called from app | Call it from a "Generate Handover" button or auto-trigger at shift end |
| `label-scanner` | Built, app uses mock | Replace hardcoded mock in `scanner.tsx` with real function call |
| `line-notifier` | Built, called by stock-calculator only | Expose manual call from patient detail for custom family messages |

---

## NICE TO HAVE

- [ ] Add swipe-to-confirm gesture on medication cards (swipe right = confirm, left = skip)
- [ ] Dark mode support (NativeWind `dark:` classes)
- [ ] Biometric login (Face ID / fingerprint) via `expo-local-authentication`
- [ ] Voice readout of patient name + medication via ElevenLabs TTS on dispense confirmation
- [ ] QR code per patient for quick profile lookup (generate with `react-native-qrcode-svg`)
- [ ] Offline-first: cache schedule and patient list in MMKV for no-network shifts
- [ ] Animated loading skeleton screens instead of spinner
