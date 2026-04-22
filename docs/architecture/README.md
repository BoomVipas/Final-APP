# PILLo Caregiver App — Architecture Document

**Version**: 1.0
**Owner**: System Architect
**Last Updated**: 2026-03-24
**PRD Reference**: Mobile_App_PRD.docx (Features F-1 through F-7)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Component Responsibilities](#2-component-responsibilities)
3. [Data Flow: Medication Administration](#3-data-flow-medication-administration)
4. [Realtime Subscription Strategy](#4-realtime-subscription-strategy)
5. [Offline-First Strategy](#5-offline-first-strategy)
6. [Auth Flow](#6-auth-flow)
7. [Edge Function Inventory](#7-edge-function-inventory)
8. [PRD Feature Traceability](#8-prd-feature-traceability)

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PILLo System Boundary                              │
│                                                                             │
│  ┌──────────────┐   ┌───────────────────────────────────────────────────┐  │
│  │  PILLo IoT   │   │           Supabase Backend                        │  │
│  │  Dispenser   │   │                                                   │  │
│  │  (Hardware)  │   │  ┌──────────┐  ┌────────────┐  ┌──────────────┐  │  │
│  │              │──►│  │PostgreSQL│  │  Realtime  │  │Edge Functions│  │  │
│  │  MQTT/HTTP   │   │  │+ RLS     │  │  (Channels)│  │(5 functions) │  │  │
│  └──────────────┘   │  └────┬─────┘  └─────┬──────┘  └──────┬───────┘  │  │
│                     │       │               │                │           │  │
│                     └───────┼───────────────┼────────────────┼───────────┘  │
│                             │               │                │              │
│                     ┌───────┴───────────────┴────────────────┴───────────┐  │
│                     │          Supabase JS SDK (typed)                   │  │
│                     └────────────────────────┬──────────────────────────┘  │
│                                              │                             │
│  ┌───────────────────────────────────────────▼──────────────────────────┐  │
│  │                    React Native (Expo) App                           │  │
│  │                                                                      │  │
│  │  ┌───────────────┐  ┌────────────────┐  ┌──────────────────────┐    │  │
│  │  │ Expo Router   │  │ Zustand Stores │  │   Custom Hooks        │    │  │
│  │  │ (File-based   │  │ (Server-derived│  │ useRealtimeSync       │    │  │
│  │  │  navigation)  │  │  state)        │  │ useMedicationSchedule │    │  │
│  │  └───────┬───────┘  └───────┬────────┘  │ useInventoryAlerts    │    │  │
│  │          │                  │           └──────────────────────┘    │  │
│  │  ┌───────▼──────────────────▼───────────────────────────────────┐   │  │
│  │  │                   UI Layer (NativeWind)                      │   │  │
│  │  │  app/(tabs)/  app/patient/[id]  app/handover  app/scanner    │   │  │
│  │  └──────────────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  External Services:                                                         │
│  ┌─────────────┐  ┌───────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Anthropic   │  │ ElevenLabs    │  │ LINE Messaging│  │ Expo Push     │  │
│  │ Claude API  │  │ TTS API       │  │ API          │  │ Notifications │  │
│  │ (F-6 scan)  │  │ (voice remnd) │  │ (F-7 family) │  │ (F-2/F-3/F-5)│  │
│  └─────────────┘  └───────────────┘  └──────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Research site**: Saensuk Healthcare Center, Nonthaburi — 54 residents, 7 wards (~7-8 patients each), 2 caregivers per shift.

---

## 2. Component Responsibilities

### 2.1 Mobile App Layers

#### Expo Router Screens (`app/`)
- **`(tabs)/index.tsx`** — Dashboard: active patient count, next due medications, unacknowledged handovers. Subscribes to `medication_logs` and `shift_handovers` realtime channels.
- **`(tabs)/schedule.tsx`** — Time-based medication schedule grouped by meal period. Triggers medication-engine on administration. PRD F-2.
- **`(tabs)/patients.tsx`** — Patient directory with ward filter and search. Loads from `patientStore`. PRD F-4.
- **`patient/[id].tsx`** — Full patient medication profile: active prescriptions, recent logs, stock levels. PRD F-4.
- **`handover.tsx`** — Shift handover acknowledgment screen. Displays HandoverSummary, requires caregiver confirmation. PRD F-1.
- **`scanner.tsx`** — Drug label camera screen. Calls label-scanner Edge Function. PRD F-6.

#### Zustand Stores (`src/stores/`)
- **`authStore`** — Supabase session, caregiver profile, ward assignments, JWT refresh.
- **`patientStore`** — Patients list for assigned wards. Hydrates on login, updates on Realtime INSERT/UPDATE.
- **`medicationStore`** — Active schedules, today's logs, schedule groups. Owns realtime subscription to `medication_logs`.
- **`notificationStore`** — Unread notification count, depletion alerts, pending handovers.

#### Custom Hooks (`src/hooks/`)
- **`useRealtimeSync`** — Manages Supabase Realtime channel lifecycle (subscribe / unsubscribe on mount/unmount). Used by stores, not components directly.
- **`useMedicationSchedule`** — Derives `MedicationScheduleGroup[]` from store data. Handles time-window computation. PRD F-2.
- **`useInventoryAlerts`** — Polls `inventory` table and computes `DepletionAlert[]`. PRD F-3.

#### Library (`src/lib/`)
- **`supabase.ts`** — Typed Supabase client singleton (`createClient<Database>`). Single source for all DB access.
- **`claude.ts`** — Anthropic SDK wrapper for label scanner vision calls. PRD F-6.
- **`line.ts`** — LINE Messaging API helper for direct sends if needed. PRD F-7.
- **`notifications.ts`** — Expo push token registration, local notification scheduling.

### 2.2 Supabase Backend

#### PostgreSQL + RLS
- All 11 tables with Row Level Security policies (ward-scoped access).
- 3 custom DB functions: `calculate_depletion_date`, `check_duplicate_dose`, `generate_handover_summary`.
- pgvector extension for medication name similarity search (label scanner matching).

#### Edge Functions (`supabase/functions/`)
See [Section 7](#7-edge-function-inventory) for full inventory.

---

## 3. Data Flow: Medication Administration

This is the core P0 flow covering anti-duplicate check, logging, and stock update (PRD F-2, F-3).

```
Caregiver taps "Administer" on schedule card
           │
           ▼
  [1] useMedicationSchedule hook
      - Derives TimeWindow for the schedule slot
        (scheduled_time ± window_before/after_minutes)
      - Checks isWithinWindow === true
           │
           ▼
  [2] Anti-Duplicate Pre-Check (Client-side optimistic)
      - Queries medicationStore: any log for this schedule_id
        with administered_at WITHIN current TimeWindow?
      - If YES → show ConflictCheck modal, block action
      - If NO → proceed
           │
           ▼
  [3] Call medication-engine Edge Function
      POST /functions/v1/medication-engine
      Body: { schedule_id, caregiver_id, method, timestamp }
           │
           ▼
  [4] medication-engine (Edge Function, server-authoritative)
      - Calls check_duplicate_dose(schedule_id, window_minutes)  ← DB function
      - If duplicate found → return 409 Conflict
      - Inserts row into medication_logs
        { status: 'administered', is_duplicate_check_passed: true, ... }
      - Decrements inventory.current_count by dose_quantity
      - Calls calculate_depletion_date() → updates inventory.estimated_depletion_date
      - If new count < critical_threshold → enqueues stock alert
           │
           ▼
  [5] Supabase Realtime broadcasts INSERT on medication_logs
           │
      ┌────┴────────────────────────────────┐
      │                                     │
      ▼                                     ▼
  [6a] medicationStore listener          [6b] notificationStore listener
       - Updates today's logs cache           - Checks for new depletion alerts
       - Re-derives schedule groups           - Increments unread badge
       - Marks slot as isAdministered: true
           │
           ▼
  [7] UI re-renders automatically via Zustand subscription
      - Schedule card shows green "Administered" state
      - Stock badge updates if threshold crossed
           │
           ▼
  [8] Async: line-notifier Edge Function (if family contact configured)
      - Sends LINE message to family_contacts with notify_on_administration=true
      - Inserts row into notification_logs
      PRD: F-7
```

### Error Path

```
  medication-engine returns 409 Conflict
           │
           ▼
  [E1] App displays ConflictCheck modal
       - Shows: "Already administered by {conflictingCaregiver} at {time}"
       - Options: "Dismiss" or "Report Error"
       - Logs event as status='duplicate_prevented' if caregiver force-dismisses
```

---

## 4. Realtime Subscription Strategy

All Realtime subscriptions are initialized inside Zustand stores, not inside React components. Components read from store state only.

### Channel Map

| Channel Name | Table | Filter | Subscribing Store | Purpose | PRD |
|:-------------|:------|:-------|:-----------------|:--------|:----|
| `medication_logs_ward_{wardId}` | `medication_logs` | `patient_id=in.(ward_patient_ids)` | `medicationStore` | Live administration updates, anti-duplicate sync | F-2 |
| `inventory_ward_{wardId}` | `inventory` | `patient_id=in.(ward_patient_ids)` | `notificationStore` | Stock count changes, depletion alerts | F-3 |
| `prescription_changes_ward_{wardId}` | `prescription_changes` | `patient_id=in.(ward_patient_ids)` | `medicationStore` | Prescription change notifications | F-5 |
| `shift_handovers_ward_{wardId}` | `shift_handovers` | `ward_id=eq.{wardId}` | `notificationStore` | Pending handover acknowledgments | F-1 |
| `patients_ward_{wardId}` | `patients` | `ward_id=eq.{wardId}` | `patientStore` | Patient profile updates | F-4 |

### Subscription Lifecycle

```typescript
// Pattern used in all stores (example: medicationStore)
//
// 1. Subscribe on store initialization (triggered by authStore.setSession)
// 2. Filter by ward_ids from caregiver profile → RLS enforces server-side too
// 3. On app background: channels remain open (low-traffic facility network)
// 4. On logout: remove all channels via supabase.removeAllChannels()
// 5. On reconnect: re-hydrate store from DB, then re-subscribe

const channel = supabase
  .channel(`medication_logs_ward_${wardId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'medication_logs',
    filter: `patient_id=in.(${patientIds.join(',')})`,
  }, handleMedicationLogChange)
  .subscribe();
```

### What is NOT subscribed via Realtime

- `medications` table — changes very infrequently; fetched on demand.
- `caregivers` table — fetched once at login.
- `notification_logs` table — push delivery receipts not needed in real time on device.

---

## 5. Offline-First Strategy

PILLo operates in a Thai care facility where WiFi may be intermittent. Offline support is limited to the most critical P0 flow: medication administration recording.

### What is Cached Locally (AsyncStorage)

| Key | Contents | TTL |
|:----|:---------|:----|
| `pillo_schedules_{wardId}_{date}` | Full `MedicationScheduleGroup[]` for today | 24 hours |
| `pillo_patients_{wardId}` | `PatientsRow[]` for assigned ward | 4 hours |
| `pillo_pending_logs` | `OfflineMedicationCache.pendingLogs[]` | Until synced |
| `pillo_medications_catalog` | `MedicationsRow[]` (medication catalog) | 7 days |
| `pillo_last_sync` | ISO timestamp of last successful full sync | Permanent |

### Offline Administration Flow

```
Network unavailable detected (NetInfo API)
           │
           ▼
  [1] App shows "Offline Mode" banner (amber, non-blocking)
  [2] Anti-duplicate check uses cached medication_logs only
      (conservative: if cache shows administered, block)
  [3] Administration creates pending log in AsyncStorage:
      { tempId: uuid(), log: MedicationLogInsert, createdLocally: ISO }
  [4] UI optimistically marks slot as administered
           │
           ▼
  Network restored
           │
           ▼
  [5] useRealtimeSync hook detects reconnect
  [6] Iterates pendingLogs in chronological order
  [7] For each: calls medication-engine with pending log
      - If server returns 409 (duplicate) → marks as duplicate_prevented, notifies caregiver
      - If server accepts → removes from pending, updates log ID
  [8] Re-fetches today's schedule to reconcile any server-side changes
```

### Conflict Resolution Policy

**Server wins for all time-sensitive data.**

- If a pending offline log conflicts with a server log → server log takes precedence, pending log is marked `duplicate_prevented`, caregiver is notified.
- Prescription changes, inventory counts, and handover data are never modified offline — read-only cache only.
- Patient profile data: offline cache is read-only; edits require connectivity.

---

## 6. Auth Flow

```
App Launch
    │
    ▼
[1] _layout.tsx — AuthGate
    - Calls supabase.auth.getSession()
    - If valid session → route to (tabs)
    - If no session → route to /login
    │
    ▼ (on login)
[2] Caregiver enters Employee ID + PIN
    - supabase.auth.signInWithPassword({ email: employeeId@pillo.internal, password: pin })
    │
    ▼
[3] Supabase returns JWT (access_token + refresh_token)
    - JWT payload includes: sub (auth.users.id), role ('authenticated')
    │
    ▼
[4] authStore.setSession(session)
    - Fetches caregiver profile: SELECT * FROM caregivers WHERE auth_user_id = sub
    - Stores: caregiver profile, ward_ids, role
    │
    ▼
[5] RLS Enforcement (PostgreSQL)
    Every query to protected tables passes through RLS policies:
    - patients: auth.uid() in caregivers whose ward_ids overlap patient.ward_id
    - medication_logs: patient must be in caregiver's ward
    - inventory: same ward-based check
    - shift_handovers: outgoing_caregiver_id = auth.uid() OR ward_id in caregiver.ward_ids
    The app never manually adds WHERE user_id = X filters — RLS handles this.
    │
    ▼
[6] Role Check in Application Layer
    - CaregiverRole checked client-side for UI feature gating only
    - Role-based DB access restrictions enforced by RLS (pharmacist can edit medications, etc.)
    │
    ▼
[7] JWT Refresh
    - Supabase client handles automatic token refresh
    - authStore listens to supabase.auth.onAuthStateChange() for session updates
    │
    ▼
[8] Logout
    - supabase.auth.signOut()
    - authStore.clearSession() → clears all stores
    - supabase.removeAllChannels() → closes all Realtime subscriptions
    - AsyncStorage: clears non-catalog cached data
```

---

## 7. Edge Function Inventory

### 7.1 `medication-engine`

| Attribute | Value |
|:----------|:------|
| **Trigger** | HTTP POST from mobile app (administration button) |
| **Purpose** | Server-authoritative medication logging with duplicate prevention |
| **Auth** | Supabase JWT required (caregiver must be authenticated) |
| **PRD** | F-2, F-3 |

**Input:**
```typescript
interface MedicationEngineRequest {
  schedule_id: string;
  caregiver_id: string;
  method: LogMethod;
  timestamp: string;           // ISO timestamptz
  dose_given?: number;
  notes?: string;
  iot_device_id?: string;
}
```

**Output:** See `docs/architecture/api-contracts.md`.

**Logic:**
1. Validates JWT + caregiver exists.
2. Fetches schedule row to determine time window.
3. Calls `check_duplicate_dose(schedule_id, window_minutes)`.
4. If duplicate → returns 409.
5. Inserts `medication_logs` row.
6. Decrements `inventory.current_count`.
7. Calls `calculate_depletion_date()` → updates `inventory.estimated_depletion_date`.
8. If any threshold crossed → invokes `stock-calculator` as background task.

---

### 7.2 `stock-calculator`

| Attribute | Value |
|:----------|:------|
| **Trigger** | Called by `medication-engine` after each administration, OR scheduled cron (daily at 06:00) |
| **Purpose** | Compute depletion dates, fire depletion alerts, trigger LINE/push notifications |
| **Auth** | Service role (internal call) |
| **PRD** | F-3 |

**Logic:**
1. For each `inventory` row: computes `dailyRate` from active `medication_schedules`.
2. Calls `calculate_depletion_date()`.
3. If `estimatedDays <= reorder_threshold` → creates `DepletionAlert`.
4. Sends push notification to ward caregivers.
5. If `estimatedDays <= critical_threshold` → also sends LINE message.

---

### 7.3 `handover-generator`

| Attribute | Value |
|:----------|:------|
| **Trigger** | HTTP POST when caregiver taps "Prepare Handover" or automatic at shift-end time |
| **Purpose** | Generates structured HandoverSummary and persists to `shift_handovers` |
| **Auth** | Supabase JWT required |
| **PRD** | F-1 |

**Logic:**
1. Calls `generate_handover_summary(ward_id, shift_start)` DB function.
2. Collects: pending schedules, prescription changes, PRN logs, depletion alerts.
3. Inserts `shift_handovers` row with `summary_json`.
4. Sends push notification to incoming caregiver.

---

### 7.4 `label-scanner`

| Attribute | Value |
|:----------|:------|
| **Trigger** | HTTP POST from `app/scanner.tsx` with base64 image |
| **Purpose** | Extract prescription fields from drug label photo using Claude Vision |
| **Auth** | Supabase JWT required |
| **PRD** | F-6 |

**Logic:**
1. Receives base64 image.
2. Calls Anthropic Claude API (`claude-sonnet-4-6`) with vision prompt.
3. Extracts fields: drug name, strength, dose, frequency, prescribing doctor.
4. Queries `medications` table with pgvector similarity for name matching.
5. Returns `ScanResult` with confidence score.

---

### 7.5 `line-notifier`

| Attribute | Value |
|:----------|:------|
| **Trigger** | HTTP POST from other Edge Functions (medication-engine, handover-generator, stock-calculator) |
| **Purpose** | Send formatted LINE Flex messages to family contacts |
| **Auth** | Service role (internal call only) |
| **PRD** | F-7 |

**Logic:**
1. Resolves `family_contacts` for `patient_id`, filtered by `notify_on_*` flags.
2. Builds LINE Flex message from category template.
3. Calls LINE Messaging API (`/message/push`).
4. Inserts `notification_logs` row with delivery status.
5. On failure: retries up to 3 times with exponential backoff, logs error.

---

## 8. PRD Feature Traceability

| PRD ID | Feature | Priority | Components | DB Tables | Edge Functions |
|:-------|:--------|:---------|:-----------|:----------|:---------------|
| F-1 | Shift Handover | P0 | `app/handover.tsx`, `notificationStore` | `shift_handovers`, `prescription_changes` | `handover-generator` |
| F-2 | Medication Reminders + Anti-Duplicate | P0 | `app/(tabs)/schedule.tsx`, `useMedicationSchedule`, `medicationStore` | `medication_schedules`, `medication_logs` | `medication-engine` |
| F-3 | Stock Depletion Alerts | P0 | `useInventoryAlerts`, `notificationStore`, `StockAlert.tsx` | `inventory` | `stock-calculator` |
| F-4 | Digital Medication Profiles | P0 | `app/(tabs)/patients.tsx`, `app/patient/[id].tsx`, `patientStore` | `patients`, `prescriptions`, `medications` | — |
| F-5 | Prescription Change Notifications | P1 | `medicationStore` (realtime), `notificationStore` | `prescription_changes` | (trigger in `medication-engine`) |
| F-6 | Drug Label Scanner | P1 | `app/scanner.tsx`, `src/lib/claude.ts` | `prescriptions`, `medications` | `label-scanner` |
| F-7 | LINE Family Notifications | P1 | `src/lib/line.ts`, `notificationStore` | `family_contacts`, `notification_logs` | `line-notifier` |
