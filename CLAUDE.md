# PILLo Caregiver Mobile App — Project Context

---

## Current State (updated 2026-04-04)

### What is done
- **Schema reconciliation complete** — all app code (`src/types/`, `src/stores/`, `app/`, `src/components/`, `src/mocks/`) has been rewritten to match the real Supabase schema (see memory `project_actual_schema.md`)
- **`.env.local` configured** — `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set correctly
- **TypeScript compiles with zero errors** (`npx tsc --noEmit`)
- **Mock data updated** — `src/mocks/data.ts` and `src/mocks/useMockData.ts` use new field names
- **Unit tests updated** — `__tests__/unit/MedicationCard.test.tsx` matches new `ScheduleItem` shape
- **All `SafeAreaView` imports** fixed to use `react-native-safe-area-context` (not deprecated `react-native`)

### Current mode
`USE_MOCK = true` in `src/mocks/index.ts` — app runs entirely on mock data, no Supabase connection needed.
Flip to `false` when ready to test with real Supabase.

### Outstanding issues
1. **Render error on device** — `app/(tabs)/_layout.tsx` line 39: React Fabric throws "expected boolean but got string" — likely NativeWind `className` not being compiled properly on the device build. Root cause not yet fixed.
2. **Edge Functions** — `supabase/functions/` still reference old schema (`caregivers`, `medications`, `prescriptions`+`medication_schedules`). Not yet updated.
3. **`supabase/migrations/`** — generated migration files do NOT match live DB. **Do not use as schema reference.** Always use `project_actual_schema.md` memory file instead.

### Tables created in Supabase (beyond original hardware tables)
The user ran SQL to create these additional tables needed by the app:
- `medication_logs`
- `shift_handovers`
- `family_contacts`
- `notification_logs`
- `prescription_changes`

---

## Overview
PILLo is an IoT-based smart medication management system for elderly care facilities in Thailand.
This repository is the **React Native (Expo) caregiver mobile application** — the real-time coordination layer between caregivers, patients, and the PILLo pill dispenser hardware.

**Research site**: Saensuk Healthcare Center, Nonthaburi. 54 residents, 7 wards (~7–8 patients each), 2 caregivers per shift.

**Source of truth documents** (always read before writing code):
- `Mobile_App_PRD.docx` — full PRD: feature specs F-1→F-7, DB schema, tech stack, UX constraints, 10-day sprint plan
- `Pillo_notes(1).pdf` — original UI/UX design notes (Thai language). Note: **new frontend design incoming** — build components modular for easy reskinning

---

## Tech Stack

| Layer | Technology |
|:------|:-----------|
| Framework | React Native + Expo SDK (TypeScript strict) |
| Navigation | Expo Router (file-based, `app/` directory) |
| Backend / DB | Supabase (PostgreSQL + RLS + Realtime) |
| State | Zustand |
| Styling | NativeWind (Tailwind CSS for RN) |
| Push Notifications | Expo Push Notifications |
| AI / Vision | Anthropic Claude API (claude-sonnet-4-6) |
| Voice TTS | ElevenLabs TTS API |
| External Messaging | LINE Messaging API |
| Vector Search | Supabase pgvector |
| Testing | Jest + React Native Testing Library |

**Architecture constraint**: All backend logic lives in Supabase Edge Functions or direct SDK calls. **No n8n** in the mobile backend.

---

## Folder Structure

```
/
├── app/                        # Expo Router screens
│   ├── (tabs)/                 # Bottom tab navigator
│   │   ├── index.tsx           # Home — Dashboard
│   │   ├── patients.tsx        # Patients — directory + search
│   │   ├── schedule.tsx        # Schedule — time-based view
│   │   └── settings.tsx        # Settings
│   ├── patient/
│   │   └── [id].tsx            # Patient detail (medication profile)
│   ├── handover.tsx            # Shift handover acknowledgment
│   ├── scanner.tsx             # Drug label scanner (Claude Vision)
│   └── _layout.tsx             # Root layout + auth gate
│
├── src/
│   ├── types/                  # TypeScript interfaces (DB-mirroring types)
│   │   ├── database.ts         # All Supabase table types
│   │   ├── medication.ts       # Medication domain types
│   │   └── index.ts            # Re-exports
│   ├── stores/                 # Zustand stores
│   │   ├── authStore.ts
│   │   ├── patientStore.ts
│   │   ├── medicationStore.ts
│   │   └── notificationStore.ts
│   ├── hooks/                  # Custom React hooks
│   │   ├── useRealtimeSync.ts
│   │   ├── useMedicationSchedule.ts
│   │   └── useInventoryAlerts.ts
│   ├── components/
│   │   ├── ui/                 # Base design-system components (reskinnable)
│   │   │   ├── Card.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Badge.tsx
│   │   │   └── StatusIndicator.tsx
│   │   └── shared/             # Feature-level composites
│   │       ├── MedicationCard.tsx
│   │       ├── PatientRow.tsx
│   │       ├── HandoverSummary.tsx
│   │       └── StockAlert.tsx
│   └── lib/
│       ├── supabase.ts         # Supabase client singleton
│       ├── claude.ts           # Claude API helper
│       ├── line.ts             # LINE Messaging API helper
│       └── notifications.ts    # Expo push notification helpers
│
├── supabase/
│   ├── migrations/             # SQL migration files (ordered)
│   ├── functions/              # Edge Functions
│   │   ├── medication-engine/
│   │   ├── stock-calculator/
│   │   ├── handover-generator/
│   │   ├── label-scanner/
│   │   └── line-notifier/
│   └── seed/                   # Seed data SQL
│
├── __tests__/
│   ├── unit/                   # Jest unit tests for business logic
│   └── integration/            # E2E tests against staging Supabase
│
├── docs/
│   ├── architecture/           # System design, data flow, API contracts
│   └── agent-teams-reference.md
│
├── tests/
│   └── report.md               # QA pass/fail report
│
└── CLAUDE.md                   # ← You are here
```

---

## Key Commands

```bash
# Development
npx expo start              # Start dev server (scan QR with Expo Go)
npx expo start --ios        # Start on iOS simulator
npx expo start --android    # Start on Android emulator

# Testing
npm test                    # Run Jest unit tests
npm test -- --coverage      # With coverage report
npm test -- --watch         # Watch mode

# Database (Supabase CLI)
supabase db reset           # Reset local DB and apply all migrations
supabase db push            # Push migrations to remote
supabase functions serve    # Run Edge Functions locally
supabase seed               # Run seed data

# Type checking
npx tsc --noEmit            # Type-check without building
```

---

## Coding Conventions

### TypeScript
- `strict: true` in tsconfig — no implicit `any`
- All DB table rows typed from `src/types/database.ts`
- Prefer `interface` over `type` for object shapes
- All async functions must handle errors explicitly

### Components
- Every component in `src/components/ui/` must be reskinnable (no hardcoded colors/fonts outside NativeWind classes)
- Use NativeWind className for all styling — no StyleSheet.create in UI components
- Minimum touch target: `min-h-[48px] min-w-[48px]` on all interactive elements
- Primary accent: `#E8721A` (orange) → `text-orange-500` / `bg-orange-500` in NativeWind
- Red for critical alerts only. Green for confirmed. Gray for inactive.

### Localization
- All user-facing strings externalized — no hardcoded Thai or English text in JSX
- Thai (th-TH) primary, English (en-US) secondary
- Drug names always shown as `{name_th} / {name_en}`

### State
- Zustand stores own all server-derived state
- Local UI state (`useState`) for transient UI only
- Realtime subscriptions initialized in stores, not components

### Supabase
- All DB access via typed Supabase client from `src/lib/supabase.ts`
- Always use `.select('column list')` — never `select('*')` in production queries
- RLS policies enforced at DB level — never filter by user ID in app code alone

---

## Feature Map (PRD → Code)

| Feature | PRD ID | Priority | Key files |
|:--------|:-------|:---------|:----------|
| Shift Handover | F-1 | P0 | `app/handover.tsx`, `supabase/functions/handover-generator/` |
| Medication Reminders + Anti-Duplicate | F-2 | P0 | `app/(tabs)/schedule.tsx`, `src/hooks/useMedicationSchedule.ts` |
| Stock Depletion Alerts | F-3 | P0 | `supabase/functions/stock-calculator/`, `src/hooks/useInventoryAlerts.ts` |
| Digital Medication Profiles | F-4 | P0 | `app/(tabs)/patients.tsx`, `app/patient/[id].tsx` |
| Prescription Change Notifications | F-5 | P1 | `supabase/functions/` prescription change trigger |
| Drug Label Scanner | F-6 | P1 | `app/scanner.tsx`, `supabase/functions/label-scanner/` |
| LINE Family Notifications | F-7 | P1 | `supabase/functions/line-notifier/`, `src/lib/line.ts` |

---

## Database Quick Reference

Core tables: `patients`, `medications`, `prescriptions`, `medication_schedules`, `medication_logs`, `inventory`, `prescription_changes`, `shift_handovers`, `caregivers`, `family_contacts`, `notification_logs`

Full schema in `docs/architecture/schema.md` and `supabase/migrations/`.

Key DB functions:
- `calculate_depletion_date(patient_id, medication_id)` → date
- `check_duplicate_dose(schedule_id, time_window_minutes)` → boolean
- `generate_handover_summary(ward_id, shift_start)` → json

---

## UX Constraints (Non-Negotiable)

1. Thai primary / English secondary on all labels
2. Minimum 48×48dp touch targets on all interactive elements
3. Full-width buttons for primary actions (confirm medication, acknowledge handover)
4. Orange `#E8721A` accent — never used for alerts (red only for critical)
5. Card-based layouts — no table/row-dense UI
6. Emoji and icon-first status indicators (minimal text labels)
7. No complex forms — prefer camera scan, dropdown, toggle

---

## Environment Variables

Create `.env.local` (never commit):
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
LINE_CHANNEL_ACCESS_TOKEN=
ELEVENLABS_API_KEY=
```

---

## Agent Team Notes

When working as part of an agent team on this project:
- **System Architect** owns: `docs/architecture/`, `src/types/`, initial `CLAUDE.md`
- **Database Dev** owns: `supabase/migrations/`, `supabase/seed/`
- **Backend Dev** owns: `supabase/functions/`
- **Frontend Dev** owns: `app/`, `src/components/`, `src/stores/`, `src/hooks/`
- **QA** owns: `__tests__/`, `tests/report.md`

File conflict rule: **each agent owns different files**. If you need to edit a file outside your ownership, message the owner agent first.
