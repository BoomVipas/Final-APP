# PILLo Edge Function API Contracts

**Version**: 1.0
**Owner**: System Architect / Backend Dev
**Base URL**: `https://<project-ref>.supabase.co/functions/v1`
**PRD Reference**: Mobile_App_PRD.docx (Features F-1, F-2, F-3, F-6, F-7)

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Common Error Codes](#2-common-error-codes)
3. [medication-engine](#3-medication-engine)
4. [stock-calculator](#4-stock-calculator)
5. [handover-generator](#5-handover-generator)
6. [label-scanner](#6-label-scanner)
7. [line-notifier](#7-line-notifier)

---

## 1. Authentication

All Edge Functions require a valid Supabase JWT unless marked as **internal** (service role only).

**Header for caregiver-facing endpoints:**
```
Authorization: Bearer <supabase_access_token>
Content-Type: application/json
```

**Header for internal (service-to-service) endpoints:**
```
Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
Content-Type: application/json
```

Tokens are verified by the Supabase Edge Runtime. The caregiver's `auth.uid()` is available inside the function as `Deno.env.get('SUPABASE_AUTH_USER_ID')` via the helper or by decoding the JWT.

---

## 2. Common Error Codes

All error responses follow this shape:

```typescript
interface ErrorResponse {
  error: string;        // Machine-readable error code
  message: string;      // Human-readable description
  details?: unknown;    // Optional additional context
}
```

| HTTP Status | Error Code | Description |
|:------------|:-----------|:------------|
| 400 | `INVALID_REQUEST` | Missing or malformed request body |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT |
| 403 | `FORBIDDEN` | JWT valid but caregiver lacks permission for this action |
| 404 | `NOT_FOUND` | Referenced record does not exist |
| 409 | `DUPLICATE_DOSE` | Duplicate administration detected within time window |
| 409 | `HANDOVER_EXISTS` | Handover already exists for this ward/shift |
| 422 | `VALIDATION_ERROR` | Business rule violation (e.g. schedule not active) |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
| 503 | `EXTERNAL_SERVICE_ERROR` | Upstream API (Claude, LINE) unavailable |

---

## 3. `medication-engine`

**PRD**: F-2 (Medication Reminders + Anti-Duplicate), F-3 (Stock Depletion side effect)
**Method**: `POST`
**Path**: `/medication-engine`
**Auth**: Caregiver JWT required

### Request Schema

```typescript
interface MedicationEngineRequest {
  /** UUID of the medication_schedules row */
  schedule_id: string;
  /** UUID of the caregivers row — must match JWT identity */
  caregiver_id: string;
  /** How the administration was performed */
  method: 'manual' | 'iot_dispenser' | 'scanner' | 'voice_confirm';
  /** Actual administration timestamp (ISO 8601 with timezone) */
  timestamp: string;
  /** Actual dose given — omit if equals schedule default */
  dose_given?: number;
  /** Caregiver notes */
  notes?: string;
  /** PILLo hardware device ID — required when method = 'iot_dispenser' */
  iot_device_id?: string;
}
```

### Response Schema (200 OK)

```typescript
interface MedicationEngineResponse {
  /** Newly created medication_logs UUID */
  log_id: string;
  /** Administration status recorded */
  status: 'administered' | 'partial';
  /** Confirms anti-duplicate check was performed and passed */
  duplicate_check_passed: true;
  /** Updated inventory snapshot */
  inventory: {
    current_count: number;
    unit: string;
    estimated_depletion_date: string | null;
    threshold_status: 'ok' | 'warning' | 'critical';
  };
  /** Present if a depletion alert was triggered */
  depletion_alert?: {
    threshold: 'warning' | 'critical';
    estimated_days: number;
  };
}
```

### Error Responses

| Status | Error Code | When |
|:-------|:-----------|:-----|
| 400 | `INVALID_REQUEST` | Missing `schedule_id`, `caregiver_id`, or `timestamp` |
| 403 | `FORBIDDEN` | `caregiver_id` in body does not match JWT `sub` |
| 404 | `NOT_FOUND` | `schedule_id` does not exist or is inactive |
| 409 | `DUPLICATE_DOSE` | Duplicate administration found within time window |
| 422 | `VALIDATION_ERROR` | Schedule's prescription is not `active` |

### Example Request

```json
POST /functions/v1/medication-engine
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "schedule_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "caregiver_id": "1234abcd-0000-4562-b3fc-aabbccddeeff",
  "method": "manual",
  "timestamp": "2026-03-24T08:15:00+07:00",
  "notes": "ผู้ป่วยรับประทานยาได้ปกติ"
}
```

### Example Response (200 OK)

```json
{
  "log_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "status": "administered",
  "duplicate_check_passed": true,
  "inventory": {
    "current_count": 21,
    "unit": "tablet",
    "estimated_depletion_date": "2026-04-14",
    "threshold_status": "ok"
  }
}
```

### Example Response (409 Conflict — Duplicate Dose)

```json
{
  "error": "DUPLICATE_DOSE",
  "message": "Medication already administered within the time window",
  "details": {
    "existing_log_id": "7d1e5b3a-2c1d-4abc-9f0e-112233445566",
    "administered_at": "2026-03-24T07:52:00+07:00",
    "caregiver_name": "นางสาว สมใจ มีสุข"
  }
}
```

---

## 4. `stock-calculator`

**PRD**: F-3 (Stock Depletion Alerts)
**Method**: `POST`
**Path**: `/stock-calculator`
**Auth**: Service role (internal) OR Caregiver JWT (for manual restock trigger)

### Request Schema

```typescript
interface StockCalculatorRequest {
  /** Scope: calculate for a single patient, a ward, or all wards */
  scope: 'patient' | 'ward' | 'all';
  /** Required when scope = 'patient' */
  patient_id?: string;
  /** Required when scope = 'ward' */
  ward_id?: string;
  /** If true, sends push/LINE notifications for threshold breaches (default: true) */
  notify?: boolean;
}
```

### Response Schema (200 OK)

```typescript
interface StockCalculatorResponse {
  /** Number of inventory records evaluated */
  evaluated_count: number;
  /** Inventory items updated with new depletion dates */
  updated_count: number;
  /** Alerts generated this run */
  alerts: DepletionAlertResult[];
  /** Notifications sent */
  notifications_sent: number;
}

interface DepletionAlertResult {
  patient_id: string;
  patient_name: string;
  medication_id: string;
  medication_name: string;
  current_count: number;
  daily_rate: number;
  estimated_days: number;
  estimated_depletion_date: string; // YYYY-MM-DD
  threshold: 'warning' | 'critical';
}
```

### Example Request (ward scope)

```json
POST /functions/v1/stock-calculator
Authorization: Bearer <SERVICE_ROLE_KEY>

{
  "scope": "ward",
  "ward_id": "aaaabbbb-cccc-4562-dddd-eeeeffff0000",
  "notify": true
}
```

### Example Response

```json
{
  "evaluated_count": 47,
  "updated_count": 47,
  "alerts": [
    {
      "patient_id": "p-uuid-001",
      "patient_name": "นาง ประภา สุขสม",
      "medication_id": "m-uuid-001",
      "medication_name": "Metformin 500mg",
      "current_count": 6,
      "daily_rate": 2,
      "estimated_days": 3,
      "estimated_depletion_date": "2026-03-27",
      "threshold": "critical"
    }
  ],
  "notifications_sent": 3
}
```

---

## 5. `handover-generator`

**PRD**: F-1 (Shift Handover)
**Method**: `POST`
**Path**: `/handover-generator`
**Auth**: Caregiver JWT required

### Request Schema

```typescript
interface HandoverGeneratorRequest {
  ward_id: string;
  /** ISO 8601 datetime — start of the outgoing shift */
  shift_start: string;
  /** 'morning' | 'afternoon' | 'night' */
  shift_type: 'morning' | 'afternoon' | 'night';
  outgoing_caregiver_id: string;
  /** Optional: ID of incoming caregiver if known at handover time */
  incoming_caregiver_id?: string;
  /** Additional caregiver notes for the handover */
  notes?: string;
}
```

### Response Schema (200 OK)

```typescript
interface HandoverGeneratorResponse {
  /** UUID of the newly created shift_handovers row */
  handover_id: string;
  summary: HandoverSummaryPayload;
}

interface HandoverSummaryPayload {
  ward_id: string;
  ward_name: string;
  shift_type: 'morning' | 'afternoon' | 'night';
  shift_date: string; // YYYY-MM-DD
  total_patients: number;
  fully_covered_patients: number;
  pending_items: PendingItemSummary[];
  prescription_changes: PrescriptionChangeSummary[];
  active_alerts: AlertSummary[];
  prn_medications: PrnSummary[];
}

interface PendingItemSummary {
  schedule_id: string;
  patient_name: string;
  medication_name: string;
  scheduled_at: string; // ISO timestamptz
  is_overdue: boolean;
}

interface PrescriptionChangeSummary {
  change_id: string;
  patient_name: string;
  medication_name: string;
  change_type: string;
  summary: string;
  effective_date: string;
}

interface AlertSummary {
  patient_name: string;
  medication_name: string;
  threshold: 'warning' | 'critical';
  estimated_days: number;
}

interface PrnSummary {
  patient_name: string;
  medication_name: string;
  administered_at: string;
  notes: string | null;
}
```

### Error Responses

| Status | Error Code | When |
|:-------|:-----------|:-----|
| 403 | `FORBIDDEN` | `outgoing_caregiver_id` does not match JWT |
| 404 | `NOT_FOUND` | `ward_id` not found or caregiver not assigned to ward |
| 409 | `HANDOVER_EXISTS` | Handover for this ward/shift already exists |

### Example Request

```json
POST /functions/v1/handover-generator
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "ward_id": "aaaabbbb-cccc-4562-dddd-eeeeffff0000",
  "shift_start": "2026-03-24T07:00:00+07:00",
  "shift_type": "morning",
  "outgoing_caregiver_id": "1234abcd-0000-4562-b3fc-aabbccddeeff",
  "incoming_caregiver_id": "5678efgh-0000-4562-b3fc-112233445566",
  "notes": "ผู้ป่วยห้อง 3 มีอาการไข้ต่ำ"
}
```

### Example Response

```json
{
  "handover_id": "hnd-uuid-001",
  "summary": {
    "ward_id": "aaaabbbb-cccc-4562-dddd-eeeeffff0000",
    "ward_name": "วอร์ด A",
    "shift_type": "morning",
    "shift_date": "2026-03-24",
    "total_patients": 8,
    "fully_covered_patients": 6,
    "pending_items": [
      {
        "schedule_id": "sch-uuid-001",
        "patient_name": "นาง ประภา สุขสม",
        "medication_name": "Metformin 500mg / เมตฟอร์มิน 500mg",
        "scheduled_at": "2026-03-24T12:00:00+07:00",
        "is_overdue": false
      }
    ],
    "prescription_changes": [],
    "active_alerts": [
      {
        "patient_name": "นาย สมชาย ใจดี",
        "medication_name": "Amlodipine 5mg / แอมโลดิปิน 5mg",
        "threshold": "critical",
        "estimated_days": 3
      }
    ],
    "prn_medications": []
  }
}
```

---

## 6. `label-scanner`

**PRD**: F-6 (Drug Label Scanner)
**Method**: `POST`
**Path**: `/label-scanner`
**Auth**: Caregiver JWT required
**Content-Type**: `application/json` (image sent as base64 in body)

### Request Schema

```typescript
interface LabelScannerRequest {
  /** Base64-encoded image (JPEG or PNG, max 5MB) */
  image_base64: string;
  /** MIME type of the image */
  image_mime_type: 'image/jpeg' | 'image/png' | 'image/webp';
  /** Patient context — helps narrow medication matching */
  patient_id?: string;
  /** Preferred language for extraction hints */
  language?: 'th' | 'en' | 'both';
}
```

### Response Schema (200 OK)

```typescript
interface LabelScannerResponse {
  /** Confidence 0–1 from Claude Vision extraction */
  confidence: number;
  /** Whether human review is recommended (confidence < 0.8) */
  requires_review: boolean;
  /** Extracted prescription fields */
  fields: {
    medication_name_th?: string;
    medication_name_en?: string;
    strength?: string;
    form?: string;
    dose_quantity?: number;
    dose_unit?: string;
    frequency_per_day?: number;
    route?: string;
    instructions?: string;
    prescribed_by?: string;
    start_date?: string;
    end_date?: string;
  };
  /** Best matched medication from database */
  matched_medication: {
    id: string;
    name_th: string;
    name_en: string;
    form: string;
    strength: string;
    similarity: number;
  } | null;
  /** Alternative matches (top 3) */
  alternatives: Array<{
    medication_id: string;
    medication_name: string;
    similarity: number;
  }>;
  /** Raw text extracted by Claude Vision */
  raw_text: string;
  /** Claude model version used */
  model_used: string;
}
```

### Error Responses

| Status | Error Code | When |
|:-------|:-----------|:-----|
| 400 | `INVALID_REQUEST` | Missing image or invalid base64 |
| 400 | `IMAGE_TOO_LARGE` | Image exceeds 5MB |
| 400 | `UNSUPPORTED_FORMAT` | Unsupported MIME type |
| 422 | `LOW_CONFIDENCE` | Confidence below minimum threshold (0.3); no fields returned |
| 503 | `EXTERNAL_SERVICE_ERROR` | Claude API unavailable |

### Example Request

```json
POST /functions/v1/label-scanner
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "image_base64": "/9j/4AAQSkZJRgABAQEASABIAAD...",
  "image_mime_type": "image/jpeg",
  "patient_id": "p-uuid-001",
  "language": "th"
}
```

### Example Response (High Confidence)

```json
{
  "confidence": 0.94,
  "requires_review": false,
  "fields": {
    "medication_name_th": "เมตฟอร์มิน",
    "medication_name_en": "Metformin",
    "strength": "500mg",
    "form": "tablet",
    "dose_quantity": 1,
    "dose_unit": "tablet",
    "frequency_per_day": 2,
    "route": "oral",
    "instructions": "รับประทานหลังอาหาร",
    "prescribed_by": "นพ. สมศักดิ์ วิทยา"
  },
  "matched_medication": {
    "id": "m-uuid-001",
    "name_th": "เมตฟอร์มิน",
    "name_en": "Metformin",
    "form": "tablet",
    "strength": "500mg",
    "similarity": 0.97
  },
  "alternatives": [],
  "raw_text": "ยาเมตฟอร์มิน 500mg รับประทาน 1 เม็ด วันละ 2 ครั้ง หลังอาหาร...",
  "model_used": "claude-sonnet-4-6"
}
```

### Example Response (Low Confidence — Review Required)

```json
{
  "confidence": 0.62,
  "requires_review": true,
  "fields": {
    "medication_name_en": "Amlodipine",
    "strength": "5mg"
  },
  "matched_medication": {
    "id": "m-uuid-002",
    "name_th": "แอมโลดิปิน",
    "name_en": "Amlodipine",
    "form": "tablet",
    "strength": "5mg",
    "similarity": 0.89
  },
  "alternatives": [
    {
      "medication_id": "m-uuid-003",
      "medication_name": "Amlodipine 10mg",
      "similarity": 0.71
    }
  ],
  "raw_text": "AMLODIPINE 5mg... [partially obscured]",
  "model_used": "claude-sonnet-4-6"
}
```

---

## 7. `line-notifier`

**PRD**: F-7 (LINE Family Notifications)
**Method**: `POST`
**Path**: `/line-notifier`
**Auth**: Service role only (never called directly from mobile app)

### Request Schema

```typescript
interface LineNotifierRequest {
  /** Patient whose family should be notified */
  patient_id: string;
  /** Notification category — determines message template */
  category:
    | 'dose_administered'
    | 'dose_missed'
    | 'prescription_change'
    | 'stock_alert'
    | 'daily_summary';
  /** ISO timestamp of the triggering event */
  event_time: string;
  /** Category-specific event details */
  event_data: LineEventData;
  /** Override: send only to this specific family_contact ID */
  target_contact_id?: string;
}

type LineEventData =
  | DoseAdministeredData
  | DoseMissedData
  | PrescriptionChangeData
  | StockAlertData
  | DailySummaryData;

interface DoseAdministeredData {
  medication_name: string;
  dose_quantity: number;
  dose_unit: string;
  caregiver_name: string;
  notes?: string;
}

interface DoseMissedData {
  medication_name: string;
  scheduled_at: string;
  reason?: string;
}

interface PrescriptionChangeData {
  medication_name: string;
  change_type: string;
  change_summary: string;
  effective_date: string;
}

interface StockAlertData {
  medication_name: string;
  estimated_days: number;
  threshold: 'warning' | 'critical';
}

interface DailySummaryData {
  total_scheduled: number;
  total_administered: number;
  total_missed: number;
  medications: Array<{
    name: string;
    administered: boolean;
    time?: string;
  }>;
}
```

### Response Schema (200 OK)

```typescript
interface LineNotifierResponse {
  /** Number of LINE messages sent */
  sent_count: number;
  /** Number of contacts that were skipped (LINE user ID not set, or opt-out) */
  skipped_count: number;
  /** Per-contact delivery results */
  results: LineDeliveryResult[];
}

interface LineDeliveryResult {
  family_contact_id: string;
  line_user_id: string;
  status: 'sent' | 'skipped' | 'failed';
  /** LINE API message ID on success */
  message_id?: string;
  /** notification_logs row ID for audit */
  notification_log_id: string;
  error?: string;
}
```

### Error Responses

| Status | Error Code | When |
|:-------|:-----------|:-----|
| 400 | `INVALID_REQUEST` | Missing `patient_id` or `category` |
| 401 | `UNAUTHORIZED` | Not called with service role |
| 404 | `NOT_FOUND` | `patient_id` not found |
| 503 | `EXTERNAL_SERVICE_ERROR` | LINE API returned non-200 |

### Example Request

```json
POST /functions/v1/line-notifier
Authorization: Bearer <SERVICE_ROLE_KEY>

{
  "patient_id": "p-uuid-001",
  "category": "dose_administered",
  "event_time": "2026-03-24T08:15:00+07:00",
  "event_data": {
    "medication_name": "Metformin 500mg / เมตฟอร์มิน 500mg",
    "dose_quantity": 1,
    "dose_unit": "tablet",
    "caregiver_name": "นางสาว สมใจ มีสุข",
    "notes": null
  }
}
```

### Example Response

```json
{
  "sent_count": 1,
  "skipped_count": 1,
  "results": [
    {
      "family_contact_id": "fc-uuid-001",
      "line_user_id": "Uxxx1234abcd",
      "status": "sent",
      "message_id": "wFsaiESVWV...",
      "notification_log_id": "nl-uuid-001"
    },
    {
      "family_contact_id": "fc-uuid-002",
      "line_user_id": "",
      "status": "skipped",
      "notification_log_id": "nl-uuid-002",
      "error": "No LINE user ID configured for this contact"
    }
  ]
}
```

### LINE Message Templates

All messages are bilingual (Thai primary, English secondary).

**`dose_administered` template (Flex Message):**
```
[PILLo] ยาประจำวัน / Medication Update
━━━━━━━━━━━━━━━━
ผู้ป่วย: {patient_name}
ยา: {medication_name}
จำนวน: {dose_quantity} {dose_unit}
เวลา: {event_time}
ผู้ให้ยา: {caregiver_name}
━━━━━━━━━━━━━━━━
Patient received their medication on time.
```

**`dose_missed` template:**
```
[PILLo] แจ้งเตือน: ยาที่ยังไม่ได้รับ / Missed Medication Alert
━━━━━━━━━━━━━━━━
ผู้ป่วย: {patient_name}
ยาที่พลาด: {medication_name}
กำหนดเวลา: {scheduled_at}
━━━━━━━━━━━━━━━━
⚠️ Please contact the care facility if you have questions.
```

**`stock_alert` template (critical only sent to family):**
```
[PILLo] แจ้งเตือนยาใกล้หมด / Medication Stock Alert
━━━━━━━━━━━━━━━━
ผู้ป่วย: {patient_name}
ยา: {medication_name}
เหลือประมาณ: {estimated_days} วัน
━━━━━━━━━━━━━━━━
Please arrange a medication refill soon.
```
