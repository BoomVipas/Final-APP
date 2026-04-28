# Handover Feature QA

Run: 2026-04-26T20:35:16.776Z
Base URL: http://localhost:8082

**Result:** 39 pass / 0 fail (39 total)

## Checks

| Scope | Result | Detail |
| --- | --- | --- |
| home | ✅ PASS | GET http://localhost:8082/ → 200 |
| home | ✅ PASS | pending handover CTA visible |
| home | ✅ PASS | shift period label visible |
| settings | ✅ PASS | GET http://localhost:8082/settings → 200 |
| settings | ✅ PASS | "Start Handover" menu present |
| settings | ✅ PASS | "Handover History" menu present |
| handover | ✅ PASS | GET http://localhost:8082/handover → 200 |
| handover | ✅ PASS | caregiver picker section present |
| handover | ✅ PASS | shift notes section present |
| handover | ✅ PASS | defer control visible on pending items |
| handover | ✅ PASS | caregiver row click dispatched |
| handover | ✅ PASS | acknowledge enabled (opacity 1) |
| handover | ✅ PASS | notes input persisted OK: "QA test note: defer enalapril to evening" |
| handover | ✅ PASS | preset chip "All clear" rendered: true |
| handover | ✅ PASS | preset chip "Refused" rendered: true |
| handover | ✅ PASS | preset chip "Fall risk" rendered: true |
| handover | ✅ PASS | preset chip click dispatched |
| handover | ✅ PASS | chip text appended into notes: true |
| handover | ✅ PASS | appended on new line (preserved existing text): true |
| handover | ✅ PASS | Clear button click dispatched |
| handover | ✅ PASS | notes cleared to empty after Clear: "" |
| handover | ✅ PASS | defer button click dispatched |
| handover | ✅ PASS | defer toggle flipped to "Deferred" OK |
| handover | ✅ PASS | defer side-message visible: true |
| add-medication | ✅ PASS | GET http://localhost:8082/add-medication?patientId=pt-001&patientName=%E0%B8%AA%E0%B8%A1%E0%B8%8A%E0%B8%B2%E0%B8%A2%20%E0%B8%A3%E0%B8%B1%E0%B8%81%E0%B9%84%E0%B8%97%E0%B8%A2 → 200 |
| add-medication | ✅ PASS | header rendered |
| add-medication | ✅ PASS | patient name chip "สมชาย รักไทย" visible |
| add-medication | ✅ PASS | meal time options present |
| add-medication | ✅ PASS | Save CTA label found: "บันทึก / Save" |
| add-medication | ✅ PASS | Save NOT interactive before input: tabindex=null, aria-disabled=null, opacity=1 |
| add-medication | ✅ PASS | medicine search returned matching results |
| add-medication | ✅ PASS | medicine selected |
| add-medication | ✅ PASS | meal time chip clicked |
| add-medication | ✅ PASS | Save enabled after medicine + meal time: true (opacity 1) |
| handover-history | ✅ PASS | GET http://localhost:8082/handover-history → 200 |
| handover-history | ✅ PASS | header rendered OK |
| handover-history | ✅ PASS | acknowledged-badge present OK |
| handover-history | ✅ PASS | at least one row shows pending count or notes |
| handover-history | ✅ PASS | expected ≥2 history rows, found 3 |

## Console errors

- (home/console) Failed to load resource: the server responded with a status of 400 ()
- (home/console) Failed to load resource: the server responded with a status of 400 ()
- (home/console) Failed to load resource: the server responded with a status of 400 ()
- (home/console) Failed to load resource: the server responded with a status of 400 ()
- (settings/console) Failed to load resource: the server responded with a status of 400 ()

## Screenshots

- tests/visual-qa/app/home.png
- tests/visual-qa/app/settings.png
- tests/visual-qa/app/handover-initial.png
- tests/visual-qa/app/handover-after-pick.png
- tests/visual-qa/app/handover-after-notes.png
- tests/visual-qa/app/handover-after-defer.png
- tests/visual-qa/app/handover-history.png
