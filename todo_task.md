# PILLo App — Task List

---

## STATUS UPDATE — 2026-04-28 (prescription-embedder live, RAG seeded)

### Verified working
- [x] **`prescription-embedder` edge function** built at [supabase/functions/prescription-embedder/index.ts](supabase/functions/prescription-embedder/index.ts) and deployed `--no-verify-jwt`. Two modes:
  - **Webhook mode** (default) — handles `INSERT`/`UPDATE`/`DELETE` payloads from a Supabase Database Webhook on `patient_prescriptions`. Soft-deletes (`is_active = false`) prior embeddings before inserting fresh ones, so cosine search never returns stale chunks. `is_active` flip on a row is also treated as a delete.
  - **Backfill mode** — `POST { "backfill": true }` walks every active prescription, joins `medicines` + `patients`, builds a Thai/English chunk, embeds via OpenAI `text-embedding-3-small` (1536 dims), stores in `prescription_embeddings`.
- [x] **First backfill run** — `{"embedded":8,"failed":0}`. All eight live `patient_prescriptions` now have an active embedding row.
- [x] **`label-scanner` switched OpenAI** — was Claude vision; now `gpt-4o` with `OPENAI_API_KEY` server-side. Same return shape, scanner.tsx unchanged.
- [x] **Duplicate-medication check on save removed** in [app/scanner.tsx:739-744](app/scanner.tsx#L739-L744) — every scan now creates a fresh `medicines` row per user request (2026-04-28). Comment in code documents how to restore.

### Loose ends
- [x] **HUMAN — Database Webhook wired** (2026-04-28) — Supabase Dashboard → Database → Webhooks. Hook `prescription-embedder` watches `patient_prescriptions` for Insert/Update/Delete and calls the `prescription-embedder` Edge Function (POST, 5000 ms timeout, default headers/params). Future prescription changes auto-re-embed within ~1s; backfill is no longer needed for ongoing edits.
- [x] **Voice-assistant edge function** built at [supabase/functions/voice-assistant/index.ts](supabase/functions/voice-assistant/index.ts) and deployed `--no-verify-jwt` (2026-04-28). Pipeline: Whisper (optional) → embed query (`text-embedding-3-small`) → `match_prescriptions` RPC (top-5) → Claude (`claude-sonnet-4-6`, RAG + intent extraction) → ElevenLabs TTS. Smoke test against the live function returned a coherent bilingual answer using the seeded RAG corpus. ElevenLabs is **optional**: if `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID_TH` / `ELEVENLABS_VOICE_ID_EN` are unset the function returns `tts_stubbed: true` and `audio_base64: null` — caller falls back to text. The moment those secrets ship, audio turns on with no code change.
- [x] **Voice FAB + voice screen** — orange mic FAB on home ([app/(tabs)/index.tsx](app/(tabs)/index.tsx)) opens [app/voice.tsx](app/voice.tsx). Screen now supports BOTH input modes: typed Thai/English question, and tap-mic-to-record speech path (`expo-audio` HIGH_QUALITY → m4a base64 → edge-function Whisper). Replies render as bubbles with a one-tap intent-dispatch button (via [src/lib/intents.ts](src/lib/intents.ts)) and a Replay button. Conversation persists to `voice_conversations` when `caregiver_id` is provided.
- [x] **Voice playback via on-device TTS** — `expo-speech` reads every assistant reply aloud, picking `th-TH` or `en-US` based on the reply text. Free, offline, no recurring cost. Replaces ElevenLabs as the v1 audio path because ElevenLabs free tier returns HTTP 402 `paid_plan_required` for ALL Voice Library voices (verified 2026-04-28 with both the user-picked `qSeXEcewz7tA0Q0qk9fH` and the previously-default Rachel `21m00Tcm4TlvDq8ikWAM`). Microphone permission string added to [app.json](app.json) under the `expo-audio` plugin block.
- [x] **Voice-assistant diagnostic fields** — function response now includes `tts_reason` (when secret is missing) and `tts_error` (when ElevenLabs returns non-2xx) so the front-end and operators can tell *why* `tts_stubbed` is true.
- [ ] **OPTIONAL FUTURE — re-enable ElevenLabs**: upgrade ElevenLabs to the Starter plan (~$5/mo) OR clone a Voice Library voice into the user's "My Voices" tab (which makes it API-callable on the free tier in some cases). Once a voice ID is API-callable, `tts_stubbed` flips to `false` and `audio_base64` (mp3) populates on every reply — the voice screen can then prefer ElevenLabs audio over `expo-speech` with a one-line conditional. Not blocking; on-device TTS is sufficient for v1.

---

## STATUS UPDATE — 2026-04-28 (LINE pipeline live end-to-end)

### Verified working
- [x] **QR linking flow** — caregiver generates a per-contact QR, family member scans → opens LINE OA → sends prefilled `LINK:<token>` → `line-webhook` captures `userId` and stamps `linked_at`. First real link captured: Vipas → `U0c7759ec5584f7b838b5c136d2ddbb23` at 2026-04-27 19:23 UTC.
- [x] **Daily-update Flex Message** — `ส่ง LINE / Send` from `daily-update.tsx` now delivers a real Flex Message to the linked family contact's LINE chat with V/S table, meal, shift, and (after fix below) photo hero image.
- [x] **Photo upload** — fixed [src/lib/photoUpload.ts](src/lib/photoUpload.ts): `fetch().blob()` was producing 0-byte uploads on RN; replaced with `expo-file-system` base64 → `Uint8Array` path. Photos now write real bytes to the `daily-reports` bucket.
- [x] **Care-center signature** — `caregiver_name` field in the Flex Message footer now reads from `EXPO_PUBLIC_CARE_CENTER_NAME` (default `ศูนย์ดูแลแสนสุข`) instead of the caregiver's personal name, so families see a consistent facility identity.
- [x] **Migrations 005 → 008 applied** — 005 superseded by 006 (link_token + per-contact QR), 007 (daily-reports bucket), 008 (relax bucket INSERT policy to anon for the devAuth bypass — see Critical Blocker below).
- [x] **Edge functions deployed with `--no-verify-jwt`** — required because the new `sb_publishable_*` anon-key format isn't a JWT, and the default Supabase Functions gateway rejects it as `UNAUTHORIZED_INVALID_JWT_FORMAT`. Both `line-notifier` and `line-webhook` need this flag on every redeploy.
- [x] **LINE deep-link URL fix** — [buildFamilyInviteUrl](src/lib/lineNotifier.ts) was emitting `?text=...` which LINE doesn't strip (the family member's first scan attempt sent the literal `text=LINK:...`). Now emits `?<urlencoded-message>` directly per LINE's `oaMessage` URL contract.
- [x] **UI polish** — preview modal in [app/daily-update.tsx](app/daily-update.tsx) is now scrollable (max-height 92% of screen, ScrollView `flex: 1`) and styled like a real LINE chat thread (dark `#1F1F1F` backdrop + "P" avatar + sender label + timestamp). Photo section moved to the top of the form.

### Loose ends from this work
- [ ] **Production blocker** — revert `daily-reports` storage upload policy from `TO public` (008) back to `TO authenticated` (original 007 form) once devAuth bypass is replaced by real Supabase Auth. Currently anyone with the project URL can fill the bucket. Memory file: `project_storage_policy_revert.md`.
- [ ] **Empty 0-byte placeholder** — `daily-reports/bbbb0003-0000-0000-0000-000000000003/1777318630172.jpg` was uploaded before the photo-upload fix. Harmless cruft; can be deleted manually from the Storage dashboard at any time.
- [ ] **`OPENAI_API_KEY` and `ANTHROPIC_API_KEY` in `.env.local` use the `EXPO_PUBLIC_*` prefix** — meaning they're bundled into the client app and extractable from any released APK/IPA. Rotate both and route AI calls through Edge Functions before shipping.

---

## STATUS UPDATE — 2026-04-28 (Daily family report)

### What landed

- [x] **Migration 007** ([supabase/migrations/007_daily_report_storage.sql](supabase/migrations/007_daily_report_storage.sql)) — creates the public `daily-reports` Supabase Storage bucket + three RLS policies (authenticated upload, public read for LINE CDN, owner-only delete). **Run this in the Supabase SQL editor before testing photo attachments.**
- [x] **Edge function** — added `daily_update` event type to [supabase/functions/line-notifier/index.ts](supabase/functions/line-notifier/index.ts) with a composite Flex Message builder. Conditionally renders three sections (V/S, meal, shift), optional hero image, and an auto-signed footer (`— {caregiver_name} ค่ะ`). Bypasses quiet hours. **Redeploy with `supabase functions deploy line-notifier`.**
- [x] **Client wrapper** ([src/lib/lineNotifier.ts](src/lib/lineNotifier.ts)) — new `sendDailyUpdate({ patientId, payload })` plus typed payload (`DailyVitals`, `DailyMeal`, `DailyShift`, `MealType`, `MealPortion`, `ShiftLetter`, `ShiftSleep`).
- [x] **Photo upload helper** ([src/lib/photoUpload.ts](src/lib/photoUpload.ts)) — `pickPhotoFromLibrary()`, `takePhotoWithCamera()`, `uploadPhotoForPatient({ photo, patientId })`. Uses `expo-image-picker` (already in package.json), uploads to the new bucket, returns the public URL for LINE Flex hero use.
- [x] **Composer screen** ([app/daily-update.tsx](app/daily-update.tsx)) — toggleable V/S, Meal, Shift sections; numeric V/S inputs (T, P, R, BP sys/dia, O₂, Urine, Stool); meal-type + portion + food-text; shift-letter + sleep-quality + notes; optional photo (camera or library); date defaults to today in **Buddhist Era**, time to now (both editable); preview modal renders a faithful approximation of the LINE Flex bubble before send; auto-signed with caregiver name + "ค่ะ"; recipient pill shows live count of LINE-linked contacts.
- [x] **Patient detail menu** ([app/patient/[id].tsx](app/patient/%5Bid%5D.tsx)) — added "รายงานครอบครัว / Daily family update" entry above the emergency one. The emergency entry is now prefixed with 🚨 to visually separate the two flows.
- [x] **Ward action sheet** ([app/ward/[id].tsx](app/ward/%5Bid%5D.tsx)) — same two new entries (Daily family update + 🚨 Emergency) on patient rows.
- [x] **Intent registry** ([src/lib/intents.ts](src/lib/intents.ts)) — added `daily_family_update` intent. Updated `notify_family` description to clarify it is the EMERGENCY composer.
- [x] `npx tsc --noEmit` passes with zero PILLo errors.

### Outstanding (HUMAN actions required to test the daily-report end-to-end)

- **Apply migration 007** in Supabase SQL editor (creates `daily-reports` bucket).
- **Redeploy line-notifier** — `supabase functions deploy line-notifier`. The `daily_update` event type only exists once this is pushed.
- **Confirm `LINE_CHANNEL_ACCESS_TOKEN`** is in Supabase Function secrets (already required for emergency notify).
- **iOS / Android camera + photo permissions** — `expo-image-picker` requests them at runtime; if the device has previously denied, caregivers will need to re-grant via system Settings.

### Behaviour notes

- **Buddhist Era** is the default for the date field (`d.getFullYear() + 543`). Caregivers can hand-edit if needed.
- **Auto-signature** — the LINE Flex footer renders `— {user.name} ค่ะ`. If a caregiver wants no signature, they'd need to clear `users.name` in the DB; that's an acceptable trade-off for a polite, regional-default behaviour.
- **Preview** — the in-app preview is a high-fidelity React render of the Flex bubble shape (header card, optional hero photo, V/S grid, meal block, shift block, footer). Not a literal LINE preview, but visually close enough that caregivers can spot mistakes before sending.
- **Photo flow** — picked from library or camera at quality 0.7 (≈300–500 KB at typical phone resolutions). Uploaded to `daily-reports/{patient_id}/{timestamp}.{ext}`. Public URL goes into the LINE Flex `hero` block.
- **Two channels coexist on the same edge function**: `caregiver_message` (red, emergency) and `daily_update` (orange, routine). They share `LINE_CHANNEL_ACCESS_TOKEN` and the same family-contacts table, but the menu entries on patient detail and ward make the rhythm difference visible.

---

## STATUS UPDATE — 2026-04-28 (LINE = emergency channel)

### Reframe

LINE notifications are now treated as an **emergency-only** channel — automatic when stock-critical fires, manual when the caregiver hits the alert button. The flow has to be fast enough to use during an incident, so:

- **Quiet hours removed from the family-contact form** ([app/family-contacts.tsx](app/family-contacts.tsx)). The DB columns still exist (untouched, won't break shared coworker code) but caregivers no longer see / edit them. `quiet_hours_start`/`quiet_hours_end` removed from `ContactDraft`, `EMPTY_DRAFT`, `fromRow`, validation, save payload, contact-card display, and the Supabase `select(...)` clause. `TIME_PATTERN` constant deleted (was only used by the quiet-hours validators).
- **Notify Family screen reframed as "Emergency Alert"** ([app/notify-family.tsx](app/notify-family.tsx)):
  - Header gradient switched from amber to red-coral (`#FFE4D6` → `#F8A483` → `#EF6E50`); title is now `🚨 แจ้งเหตุฉุกเฉิน / Emergency family alert`.
  - Quick-template chips above the textarea: 💊 ยาหมด, 🤒 อาการแย่ลง, 🚑 ลื่นล้ม, 🏥 มาเยี่ยมด่วน. Tapping a chip prefills the bilingual Thai message body — caregiver can send as-is or tweak.
  - Send button changed to large 64dp critical-red CTA `#EF5D5D` with warning icon and `ส่งแจ้งเหตุด่วน · Send Emergency Alert` label. Drop shadow added so the button reads as primary even at a glance.
  - Mock contacts cleaned of quiet-hours fields. Quiet-hours hint removed from recipient cards. The "Quiet hours bypassed" footnote replaced with "Emergency alerts go through immediately — keep messages short and actionable."
- **Edge function unchanged** — `caregiver_message` already bypasses quiet hours (set in the previous pass). Other event types still respect quiet hours since they're not emergency-grade — only `stock_critical` and `caregiver_message` are.

---

## STATUS UPDATE — 2026-04-28 (LINE notifier composer)

### Verified This Round

- [x] **Migration 004 applied to live Supabase** — re-probed `rzaaqoggxrlkrbmfwfym.supabase.co`. `prescription_embeddings` HTTP 200, `voice_conversations` HTTP 200, `shift_handovers.narrative_text` selectable. pgvector + RPC + RLS now live. The `004_voice_assistant.sql` file lives at [supabase/migrations/004_voice_assistant.sql](supabase/migrations/004_voice_assistant.sql) for re-deploys.
- [x] **WF12 A4 — Manual LINE family notification** — three-piece change:
  1. **Edge function** ([supabase/functions/line-notifier/index.ts](supabase/functions/line-notifier/index.ts)) — added `caregiver_message` to `EventType` + `validEventTypes`, plus a Flex Message builder (orange `#FFF3E5` header card, patient pin, body text, signature line). Quiet-hours bypass extended to caregiver-authored messages because the caregiver is making an explicit decision in the moment. **Requires `supabase functions deploy line-notifier` to push these changes live.**
  2. **Client wrapper** ([src/lib/lineNotifier.ts](src/lib/lineNotifier.ts)) — typed `sendCaregiverMessage({ patientId, patientName, text, senderName? })` and `sendStructuredEvent(...)` over `supabase.functions.invoke('line-notifier', ...)`. No client-side LINE token; the channel access token stays in Supabase Function secrets.
  3. **Composer screen** ([app/notify-family.tsx](app/notify-family.tsx)) — bilingual header, list of LINE-reachable contacts (cards with quiet-hours hint), explicit count of phone-only contacts that will be skipped, multiline TextInput with 500-char cap, sender attribution ("Sent as {name}"), full-width "ส่งทาง LINE / Send via LINE" CTA. Result toast shows `Sent / Failed / Skipped`.
- [x] **Patient detail three-dot menu** wired with new "Notify Family via LINE" item above the existing "Manage Family Contacts" / "Hospital Visit Reminder" rows ([app/patient/[id].tsx](app/patient/%5Bid%5D.tsx)).
- [x] **Intent registry updated** ([src/lib/intents.ts](src/lib/intents.ts)) — `notify_family` now routes to the new composer screen instead of the contacts list.
- [x] `npx tsc --noEmit` passes with zero PILLo errors.

### Outstanding

- **Deploy the edge function** (HUMAN) — run `supabase functions deploy line-notifier` so the production endpoint accepts the new `caregiver_message` event_type. Without this step the composer will hit the old function and get a "Invalid event_type" 400.
- **`LINE_CHANNEL_ACCESS_TOKEN` in Supabase Function secrets** (HUMAN) — verify it's already present (per the existing checklist item above). Composer cannot send without it.
- **Phase 2 of the voice assistant** still pending — global FAB + stub voice screen using the intent registry.

---

## STATUS UPDATE — 2026-04-27 (voice-assistant prep pass)

### Verified This Round

- [x] **Auth bypass re-enabled** — `src/lib/devAuth.ts` `AUTH_BYPASS_FLAG=true` (still gated behind `__DEV__`). The on-screen "DEV bypass" banner was removed from [app/_layout.tsx](app/_layout.tsx) (component, render, and `Text`/`SafeAreaView`/`colors`/`typo` imports deleted) per user feedback that it was visually intrusive. Flip the flag back to `false` when re-enabling auth.
- [x] **Intent registry** ([src/lib/intents.ts](src/lib/intents.ts)) — typed catalog of 16 navigable intents (`go_home`, `go_wards`, `open_patient`, `view_medication_history`, `add_medication`, `weekly_fill`, `start_handover`, `notify_family`, etc.) with bilingual labels, required-param declarations, and a single `dispatchIntent(id, params, router)` function. `getIntentCatalog()` returns the same shape Claude will receive as its tool list. **This is the contract the voice assistant calls** — Claude returns `{ intent_id, params }`, the screen dispatches.
- [x] **WF6 — Medication history tab on patient detail** ([app/patient/[id].tsx](app/patient/[id].tsx)) — new `History` tab (4th, between Medication and Appointments). Reads up to 60 most recent rows from `medication_logs` joined with `medicines`, grouped by date bucket (Today / Yesterday / weekday-month-day). Each row shows time + meal_time + method tag, status pill (Confirmed green / Refused red / Skipped gray), and either refusal_reason or notes as a subline. Mock mode renders 4 sample entries. Deep-linkable via `?tab=history` query param so the `view_medication_history` intent lands on this view.
- [x] **Migration probe (live Supabase)** — checked the live project at `rzaaqoggxrlkrbmfwfym.supabase.co`. Results: `prescription_embeddings` HTTP 404 (not created), `voice_conversations` HTTP 404 (not created), `shift_handovers.narrative_text` column missing, `medication_logs` HTTP 200 (exists). **Migration `004_voice_assistant.sql` has not been applied yet** — required before Phase 3 of the voice assistant.
- [x] `npx tsc --noEmit` passes with zero PILLo errors after the new files.

### Outstanding (next session — voice assistant Phase 2 + 3)

- **Phase 2 — global FAB + stub voice screen** — pending user go-ahead. Plan: floating mic button in [app/_layout.tsx](app/_layout.tsx) (global, above tab bar via safe-area inset), opens new `app/voice-assistant.tsx` modal; stub mode uses a direct client-side Anthropic call (`EXPO_PUBLIC_ANTHROPIC_API_KEY`) that returns `{ intent_id, params, response_text }` per the intent catalog. **Security caveat**: `EXPO_PUBLIC_*` env vars are bundled into the .ipa/.apk and are extractable. Fine for dev/demo; before the Saensuk field test the call has to move server-side (the C3 edge function below).
- **Phase 3 — real RAG pipeline (Workflow 17 C1–C5)** — gated on the user running migration `004_voice_assistant.sql` against live Supabase, pasting `OPENAI_API_KEY` and `ELEVENLABS_API_KEY` into Supabase Function secrets, and creating the `prescription-embedder` webhook in the Supabase Dashboard. Edge functions to be authored: `prescription-embedder` (webhook on `patient_prescriptions`) and `voice-assistant` (Whisper → embed → match → Claude → ElevenLabs).
- **WF12 A4 — Manual "Notify Family" via LINE** — composer modal still pending. The `notify_family` intent currently routes to the family-contacts screen as a stand-in until the composer ships.

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

## STATUS UPDATE — 2026-04-27 (third pass)

### Verified This Round

- [x] **Home dashboard ellipsis** ([app/(tabs)/index.tsx](app/%28tabs%29/index.tsx)) — patient card three-dot menu now opens View Profile / Confirm Dose (routes to `/(tabs)/schedule`) / Skip N pending (with confirm step that iterates `medicationStore.skipDose` per item, then re-loads). New `skipDose(item, caregiverId, notes?)` action in `medicationStore` writes `status:'skipped'` + `method:'normal'` + optional notes.
- [x] **Home realtime subscription** — `useEffect` on Home now subscribes via `medicationStore.subscribeToRealtime(wardScope, todayStr)` and tears down on ward/date change. Listens to `medication_logs` channel and calls `fetchSchedule` on any insert/update/delete.
- [x] **Schedule date navigation verified** — already correct: prev/next `TouchableOpacity` mutates `currentDate` → derived `dateStr` change → `useEffect` re-runs `loadSchedule` with the new date.
- [x] **Appointments + Device tabs on patient detail** ([app/patient/[id].tsx](app/patient/%5Bid%5D.tsx)) — Appointments tab renders an empty-state card explaining hospital booking integration is not wired (we have no `appointments` table). Device tab is now live: queries `cabinet_slots` joined with `medicines`, renders one card per slot with `Slot #N · Partition / Medicine name / N/Initial units · expiry` and a tone-aware badge (`Low` / `Watch` / `OK`).
- [x] **Medication discontinuation** — local `MedicationCard` three-dot menu adds a destructive "Discontinue" action that sets `patient_prescriptions.is_active = false` and bumps a refresh tick to re-pull the screen.
- [x] **Stock level bar (Workflow 9)** — same `MedicationCard` now derives `stockPercent` from `cabinet_slots.quantity_remaining / initial_quantity` joined to the prescribed medicine. Renders a 6dp bar with critical/warning/ok colors plus `quantityRemaining / initialQuantity  ·  Refill soon` line.
- [x] **Request Refill action (Workflow 9)** — same menu inserts a `prescription_changes` row of type `modified` with `new_json:{ kind:'refill_request', medicine, requested_by }`. Mock mode shows an alert.
- [x] **Expo push token registration (Workflow 10)** — new `registerForPushNotificationsAsync()` in [src/lib/notifications.ts](src/lib/notifications.ts) requests permission, configures the Android channel, fetches the token via `Notifications.getExpoPushTokenAsync()`, and caches it under `pillo:expo_push_token` in AsyncStorage. `authStore.signIn` and `authStore.initialize` both call `attemptPushRegistration()` after a session is established (silent on failure). Schema has no `users.expo_push_token` column yet — token only lives in AsyncStorage until that migration lands.
- [x] **Push notification response handler** — new `<NotificationRouter />` in [app/_layout.tsx](app/_layout.tsx) listens via `Notifications.addNotificationResponseReceivedListener`. Routes by `data.kind`: `refill_reminder` / `stock_alert` → `/patient/{id}` (or notifications fallback); `handover_pending` → `/handover`; `medication_due` → schedule tab; default falls back to `patient/{id}` if a `patient_id` is present.
- [x] **Dispensing report share** ([app/report.tsx](app/report.tsx)) — header gained a Share button next to Back. On tap composes a plain-text body (totals + "Most active patients" + a tiny CSV section) and calls React Native's built-in `Share.share`. No new dep needed (`expo-sharing` was not installed).
- [x] **Family Contacts screen** — new [app/family-contacts.tsx](app/family-contacts.tsx). Lists `family_contacts` for `?patientId=...` with name, relationship, phone, LINE user ID, and quiet-hours window. Add/edit modal with bilingual labels, phone-pad keyboard, format validation on `HH:MM`. Linked from Patient Detail header three-dot menu.
- [x] **Hospital Visit Reminder screen** — new [app/hospital-visit.tsx](app/hospital-visit.tsx). YYYY-MM-DD + HH:MM inputs (default to next weekday at 09:30), notes, two switches: Notify family via LINE / Schedule local reminder. Save inserts `notification_logs` row with `event_type:'hospital_visit_reminder'`, then optionally fires a one-day-before local Expo notification. Linked from the same Patient Detail header three-dot menu.
- [x] **A3 low-stock + fill-completion indicators** ([app/(tabs)/patients.tsx](app/%28tabs%29/patients.tsx)) — load step queries each ward's `patients` and joins `cabinet_slots` to compute (a) patients with any slot at `quantity_remaining/initial_quantity ≤ 0.15`, and (b) patients with all slots `> 0`. Ward card surfaces a red dot pill ("N low") next to the ward name and an inline "Filled X/Y" line. Demo cards render `—` when no slot data exists, matching the "no silent lying" rule from the original A3 spec.
- [x] **Offline banner (Workflow 14)** — new [src/components/shared/NetworkBanner.tsx](src/components/shared/NetworkBanner.tsx) probes `wards` every 60s with an 8s timeout; after two consecutive failures it surfaces a yellow `ขาดการเชื่อมต่อ — กำลังแสดงข้อมูลสำรอง / Offline — showing cached data` banner above the Stack. Skipped entirely in `USE_MOCK` to avoid false positives.
- [x] **Workflow 8 patient picker + save** — verified the existing scanner already inserts to `patient_prescriptions` via `handleAssign` (line 391 of [app/scanner.tsx](app/scanner.tsx)) after a patient picker modal. No change needed; ticked off the corresponding checkboxes.
- [x] `npx tsc --noEmit` passes with zero PILLo errors.

### Current Concerns (delta)

- **Push tokens not persisted server-side**. `users` table has no `expo_push_token` column, so the token only lives in AsyncStorage. Add a migration + a one-line `users.update({ expo_push_token })` after registration to actually let edge functions push to this device.
- **NetworkBanner is a polling probe**. Because `@react-native-community/netinfo` isn't installed, we can't use the OS connectivity event. The 60s poll is a coarse signal; if the user goes offline mid-screen they'll wait up to 2 cycles before seeing it. Switching to NetInfo is a small follow-up if/when that dep is added.
- **Hospital visit reminder writes to `notification_logs.recipient_id` with `patient_id`** when `notifyFamily=true`. This works because `family` recipients in this schema are addressed by their `patient_id` group, but a stricter normalization would resolve to the actual `family_contacts.id` rows — pick a contact via the picker before sending. Re-evaluate when `line-notifier` runs end-to-end.
- **Family contacts saved with raw text values** (LINE user ID, phone, quiet-hours times). No format normalization beyond `HH:MM` regex. Consider adding LINE ID validation (`^U[a-fA-F0-9]{32}$`) once the LINE channel is plumbed.
- **A3 fill-completion** uses `slot.quantity_remaining > 0` as a proxy for "filled" — fine while no `dispense_sessions` linkage exists for this view; once the cabinet-fill workflow is the canonical source, switch to the dispenser_slots / session-completed signal.
- **Discontinue is a soft-delete only** (`is_active=false`). Re-enabling later isn't surfaced anywhere yet — caregivers would need to re-add via "+ Add Medication". Acceptable for now; a "Show discontinued" filter is a nice-to-have.

---

## STATUS UPDATE — 2026-04-27 (later pass)

### Verified This Round

- [x] **Schedule confirm modal** ([app/(tabs)/schedule.tsx](app/(tabs)/schedule.tsx)) — added bilingual `Notes` TextInput (300-char cap) inside `ConfirmBottomSheet`; notes thread through to `medicationStore.confirmDose` (signature widened to `{ force?, method?, notes? }`) and persist on `medication_logs.notes`. Duplicate path caches `{ method, notes }` in `duplicatePending` so "Log anyway" replays the original method+notes instead of reverting to defaults.
- [x] **Refusal flow** — new `RefuseReasonSheet` (Thai+English radio list: ผู้ป่วยปฏิเสธ / ผู้ป่วยหลับ / อาเจียน / NPO / อื่นๆ) reachable via "ปฏิเสธ / Refuse instead" link inside `ConfirmBottomSheet`. `medicationStore.refuseDose` widened to accept optional notes; writes `status:'refused'` + `refusal_reason` + `notes`.
- [x] **Bulk Confirm All Pending** — `PeriodSection` renders a "Confirm all N pending ({period})" CTA when ≥2 pending non-conflict items exist. Iterates `confirmDose` per item with `method:'normal'`; surface counts (confirmed / duplicate-skipped / failed) in completion alert. Items with `conflict_flag` are deliberately excluded so caregivers still see the duplicate sheet.
- [x] **Notifications screen overhaul** ([app/notifications.tsx](app/notifications.tsx)) — rows are now grouped by date bucket (`Today` / `Yesterday` / weekday-month-day). Per-row tap → `markAsRead` (status `sent`→`delivered`) and clears the unread dot. Per-row "Dismiss" pill → `dismissNotification` (DELETE on `notification_logs`). Header "Mark all read" pill (only renders when `unreadCount > 0`) calls `markAllAsRead(caregiverId)`.
- [x] **NotificationStore** ([src/stores/notificationStore.ts](src/stores/notificationStore.ts)) — added `markAsRead(id)`, `markAllAsRead(caregiverId)`, `dismissNotification(id)`. All three do an optimistic update first, then revert on Supabase error.
- [x] **Set Reminder wiring** ([app/patient/[id].tsx](app/patient/%5Bid%5D.tsx)) — local `MedicationCard.handleSetReminder` now calls new `src/lib/notifications.ts` → `scheduleRefillReminder({ medicineName, daysFromNow, patientName })`. The helper requests permission once, configures an Android `pillo-reminders` channel, schedules an Expo local notification at `max(daysLeft - 1, 1)` days from now. No-op gracefully if permission denied.
- [x] **Ward action sheet** ([app/ward/[id].tsx](app/ward/%5Bid%5D.tsx)) — patient-row `onMore` now opens View Profile / Mark urgent (toggles `usePatientStore.urgentPatientIds`, also drives the orange `urgent` badge in `livePatientCards`) / Contact family (placeholder explaining it ships with Workflow 15 A4) / Cancel.
- [x] **Confirm Dispense — write the side-effect tables** — `runDispense` in [app/ward/[id].tsx](app/ward/%5Bid%5D.tsx) now inserts a `dispense_items` row per patient (slot_index / meal_time / quantity / status:'dispensed' / dispensed_at) and decrements `cabinet_slots.quantity_remaining` for the matching `(medicine_id, cabinet_position)`. Existing `dispense_sessions` + `medication_logs` writes preserved.
- [x] **Role-based menu gating** ([app/(tabs)/settings.tsx](app/(tabs)/settings.tsx)) — Start Handover and Handover History rows are now nested under `canManageHandovers = role === 'admin' || role === 'nurse'` so plain caregiver accounts no longer see them.
- [x] `npx tsc --noEmit` passes with zero PILLo errors.

### Current Concerns

- "Mark urgent" only persists in-memory on `usePatientStore.urgentPatientIds`. Once we have a column or a `urgent_flags` table, swap the toggle to a DB write so urgency survives reload + multi-device.
- Refill reminders schedule against `Math.max(daysLeft - 1, 1)` days — for synthetic demo data with `daysLeft = 3` that fires in 2 days; verify the math against real `cabinet_slots` depletion calc once `stock-calculator` is wired (Workflow 9 cron).
- `dispense_items.meal_time` is typed as `string` in `database.ts` but the table likely has a `MealTime` enum constraint — insert is fine today but should be tightened to `MealTime`.
- `dismissNotification` does a hard DELETE; if Supabase RLS blocks `DELETE` for caregivers (likely scoped to admin), the optimistic state will revert and the row reappears. Smoke-test against real RLS before claiming Workflow 9 done.
- Bulk-confirm doesn't surface per-failure detail — caregivers only see a count summary. If a real DB error happens (RLS, FK), they'd have to retry one-by-one.

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
- [ ] **Revert `daily-reports` storage upload policy from `TO public` (008) back to `TO authenticated` (original 007 form) once real Supabase Auth replaces devAuth.** Currently `008_storage_anon_upload.sql` allows anon writes because the dev bypass runs as the `anon` role. Public writes mean anyone with the project URL can fill the bucket with junk. Production-blocker — the bucket itself stays public-read (LINE CDN needs it), but writes must require an authenticated session.

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
- [x] Role-based screen filtering — `app/(tabs)/settings.tsx` now gates Start Handover + Handover History behind `canManageHandovers = role === 'admin' || role === 'nurse'`. Dispensing Report was already gated. Plain `caregiver` accounts no longer see admin/nurse rows.
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
- [x] Wire three-dot ellipsis menus on patient cards — action sheet now opens View Profile / Confirm Dose (routes to `/(tabs)/schedule`) / Skip N pending (iterates `medicationStore.skipDose` after a confirmation step).
- [x] Add realtime subscription on home screen — `useEffect` subscribes to `medicationStore.subscribeToRealtime(wardScope, todayStr)`; tears down on ward/date change. Re-fetches schedule on any `medication_logs` change.

---

## WORKFLOW 3 — Schedule & Medication Confirmation

- [x] Save admin method to `medication_logs` — already pass-through (verified 2026-04-27); `notes` now flows through too.
- [x] Add refusal reason prompt — `RefuseReasonSheet` reachable via "ปฏิเสธ / Refuse instead" link in `ConfirmBottomSheet`. Bilingual radio list + optional notes; writes `status:'refused'` + `refusal_reason` + `notes`.
- [x] Add notes field in bottom sheet confirmation modal — bilingual `Notes` TextInput in `ConfirmBottomSheet` (300-char cap), threaded through `confirmDose`.
- [x] Implement bulk confirm — "Confirm all N pending" CTA per `PeriodSection` when ≥2 non-conflict items pending; surfaces confirmed / duplicate-skipped / failed counts.
- [x] Fix date navigation prev/next arrows — verified: `currentDate` state mutation triggers derived `dateStr` change → `useEffect` re-runs `loadSchedule(wardId, dateStr)` correctly.

---

## WORKFLOW 4 — Ward Detail (Patients Tab)

- [x] Replace hardcoded `WARD_PATIENTS` in `app/ward/[id].tsx` — fetch from `usePatientStore()` filtered by the ward `id` param
- [x] Replace hardcoded stats (16 / 12 / 4) — derive from `patientStore.patients.length`, `medicationStore.completedCount`, `medicationStore.pendingCount`
- [x] Wire sort button (line 334) — sort patient list by name / room / urgency
- [x] Wire three-dot ellipsis on each patient card — action sheet now opens View Profile / Mark urgent (toggles `usePatientStore.urgentPatientIds` + drives the orange `urgent` badge) / Contact family (placeholder; full LINE flow ships in Workflow 15 A4) / Cancel.
- [x] Implement "See More" pagination (line 349) — show all patients beyond initial 5

---

## WORKFLOW 5 — Ward Detail (Dispense Tab)

- [x] Replace hardcoded `DISPENSE_PATIENTS` — fetch pending dispense items for selected time slot from `dispense_sessions` / `dispense_items` tables
- [x] Wire time slot chips (Morning/Noon/Evening/Night) to actually filter the dispense patient list
- [x] Radio toggle on each patient row (line 388) should update local selected state
  Concern: there is still no `Confirm Dispense` button or write flow.
- [x] Add "Confirm Dispense" button — `runDispense` in `app/ward/[id].tsx` already created the `dispense_sessions` row; now also writes one `dispense_items` row per patient (slot_index / meal_time / quantity / status:'dispensed' / dispensed_at) and decrements `cabinet_slots.quantity_remaining` for the matching `(medicine_id, cabinet_position)`. Verify against real RLS before flipping mock off.
- [x] Expand "N People Paid" section to show the list of already-dispensed patients
- [x] Replace hardcoded `DISPENSED_COUNT = 14` with a live count from the current route data source
  Concern: count is no longer hardcoded, but it is not exposed through a shared store yet.

---

## WORKFLOW 6 — Patient Detail

- [x] Wire "+ Add Medication" button (`app/patient/[id].tsx` line 468) → push to a new `app/add-medication.tsx` screen with patient_id pre-filled
- [x] Build `app/add-medication.tsx` — form for medicine name, dose, meal times, start/end date; saves to `patient_prescriptions` table
  Note (2026-04-27): full form with medicine search picker (queries `medicines` with mock fallback), dose stepper, meal-time multi-select chips, ISO start/end date inputs (no date-picker library — text inputs with regex validation), notes. Save inserts into `patient_prescriptions`. Mock mode simulates with 600ms delay + alert. CTA disabled until medicine + ≥1 meal time + valid start_date. Verified by 10 puppeteer assertions (39/39 total in tests/visual-qa/handover-qa.mjs). Follow-up: real date picker, refresh-on-save signal back to patient detail, mock-mode in-memory persistence.
- [x] Wire "Set Reminder" buttons — local `MedicationCard.handleSetReminder` in `app/patient/[id].tsx` calls new [src/lib/notifications.ts](src/lib/notifications.ts) → `scheduleRefillReminder({ medicineName, daysFromNow, patientName })`. Helper requests permission, sets up Android `pillo-reminders` channel, schedules an Expo local notification at `max(daysLeft - 1, 1)` days. Permission denial is surfaced in a fallback alert.
- [x] Build Appointments tab content — empty state explains hospital-system integration is pending (no `appointments` table in current schema).
- [x] Build Device tab content — `cabinet_slots` joined with `medicines` rendered as one card per slot (`Slot #N · Partition / Medicine name / N/Initial units · expiry`) with `Low / Watch / OK` tone badge.
- [x] Add medication discontinuation — three-dot menu on each med card now writes `is_active=false` to `patient_prescriptions`, then bumps a refresh tick to re-pull active prescriptions.
- [x] Add medication history tab or section — list past `medication_logs` for this patient sorted by date
  Note (2026-04-27): new `History` tab on [app/patient/[id].tsx](app/patient/[id].tsx) renders the latest 60 logs (medicine name + strength, time, meal_time, method, status pill, refusal_reason / notes) grouped by date bucket. Deep-linkable via `?tab=history`; mock-mode shows 4 sample rows.

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
- [x] After successful scan review, save a real `patient_prescriptions` record — already wired via `handleAssign` (line 391 of `app/scanner.tsx`).
- [x] Add patient picker step before/after scan — already wired: the success screen opens `AssignToPatientModal` with a patient picker before insert.
- [ ] Wire `storagePath` returned by edge function — store image URL on the prescription record
- [ ] Add barcode scanning mode (use `expo-barcode-scanner`) as fallback when camera label text is unclear

---

## WORKFLOW 9 — Stock Alerts & Inventory

- [ ] Set up a Supabase cron job (pg_cron) or DB trigger to call `supabase/functions/stock-calculator/` daily or after each `medication_logs` insert
- [x] Build "All Alerts" screen (`app/notifications.tsx`) — list all active `notification_logs` with type, patient name, days remaining; wire "View All" from home screen
  Concern: screen exists and home/profile routes are wired, but it still needs richer stock-specific actions like refill and dismiss.
- [x] Add "Mark as Read" / dismiss action on individual alerts — row tap calls `markAsRead` (status `sent`→`delivered`); per-row "Dismiss" pill calls `dismissNotification` (DELETE on `notification_logs`). Both via `useNotificationStore` with optimistic update + revert on error.
- [x] Add "Request Refill" action on Low Medication alerts — patient detail med card three-dot menu now writes a `prescription_changes` row of type `modified` with `new_json:{ kind:'refill_request', medicine, requested_by }`.
- [x] Show stock level bar on patient detail medication cards — derived from `cabinet_slots.quantity_remaining / initial_quantity` with critical/warning/ok tones; renders inline below the meal-time chips.

---

## WORKFLOW 10 — Notifications Screen

- [x] Create `app/notifications.tsx` — list view of `notification_logs`, now grouped by date bucket (Today / Yesterday / weekday-month-day) with unread dot + Dismiss pill per row.
- [x] Add "Mark all as read" button → header pill in `app/notifications.tsx` (only renders when `unreadCount > 0`) calls `markAllAsRead(caregiverId)`.
- [x] Register Expo push token on login — `registerForPushNotificationsAsync()` called from `authStore.signIn` and `authStore.initialize`; token cached at `pillo:expo_push_token` in AsyncStorage. Server-side persistence pending a `users.expo_push_token` migration.
- [x] Add push notification handler in root `_layout.tsx` — `<NotificationRouter />` listens via `addNotificationResponseReceivedListener` and routes by `data.kind` (refill_reminder/stock_alert → patient detail; handover_pending → /handover; medication_due → schedule).

---

## WORKFLOW 11 — Dispensing Report

- [x] Create `app/report.tsx` — summary of dispensing activity for current shift or date range (count confirmed/refused/skipped by patient)
- [x] Wire "Dispensing Report" menu item in `settings.tsx` line 283
- [x] Add export/share option — header Share button calls React Native `Share.share` with a plain-text body (totals + most-active patients + tiny CSV section). No new dependency required.

---

## WORKFLOW 12 — LINE Family Notifications

- [x] Build `app/family-contacts.tsx` — list/add/edit `family_contacts` for `?patientId=...`. Bilingual labels, phone-pad keyboard, `HH:MM` regex on quiet hours, soft-delete via Remove button.
- [x] Link from patient detail three-dot menu — header ellipsis on `app/patient/[id].tsx` opens "Manage Family Contacts" + "Hospital Visit Reminder" actions.
- [x] Add manual "Notify Family" action — send custom message via `line-notifier` function from patient detail
  Note (2026-04-28): see Workflow 15 A4 above. Edge function gained a `caregiver_message` event type; client wrapper at [src/lib/lineNotifier.ts](src/lib/lineNotifier.ts); composer at [app/notify-family.tsx](app/notify-family.tsx); patient-detail three-dot menu wired.
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
- [x] Add connection error handling — `<NetworkBanner />` polls `wards` every 60s with an 8s timeout; surfaces a yellow bilingual offline banner above the Stack after 2 consecutive failures. Skipped under `USE_MOCK`.
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
- [x] **A3. Patient list low-stock + fill-completion indicators** `[code]` — `app/(tabs)/patients.tsx` joins `cabinet_slots` for each ward's patients, surfaces (a) red dot pill `N low` on ward cards when any slot is at ≤15% of initial, (b) inline `Filled X/Y` line. Demo cards render `—` instead of fabricated numbers.
- [x] **A4. Manual LINE family notification from patient detail** `[code+human]` — three-dot menu item "Notify Family via LINE" in [app/patient/[id].tsx](app/patient/%5Bid%5D.tsx) opens [app/notify-family.tsx](app/notify-family.tsx). Submit posts to `supabase/functions/line-notifier/` via [src/lib/lineNotifier.ts](src/lib/lineNotifier.ts). New `caregiver_message` event_type added to the edge function with its own Flex Message template; deploy via `supabase functions deploy line-notifier`. Requires `LINE_CHANNEL_ACCESS_TOKEN` already in Supabase Function secrets (HUMAN).
  - [x] **A4-UI** `[code]` — patient name pinned in the gradient header, recipient list of LINE-reachable family contacts (with phone-only skipped count), 500-char multiline TextInput with live counter, "ส่งทาง LINE / Send via LINE" button, success alert with `Sent / Failed / Skipped` summary.
- [x] **A5. Hospital visit reminder** `[code+human]` — `app/hospital-visit.tsx` with date+time inputs, notes, "Notify family via LINE" / "Schedule local reminder" switches. Save inserts `notification_logs(event_type:'hospital_visit_reminder')` and optionally fires a one-day-before local Expo reminder. LINE delivery still requires the channel access token (HUMAN).
  - [x] **A5-UI** `[code]` — defaults to next weekday at 09:30; notes textarea; switches; full-width CTA "Save reminder".

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
| Family contacts | `app/family-contacts.tsx` | Patient Detail → ⋮ menu | Created |
| Handover history | `app/handover-history.tsx` | Home or Settings | Created |
| Voice assistant | `app/voice-assistant.tsx` | Patient Detail FAB / Home FAB | Missing (Workflow 17 C4) |
| Hospital visit reminder | `app/hospital-visit.tsx` | Patient Detail → ⋮ menu | Created (Workflow 15 A5) |
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
