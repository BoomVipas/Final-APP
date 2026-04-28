r# Figma Visual QA

Base URL: http://localhost:8082

| Screen | Route | Figma | App | Mean RGB Delta | Severe Pixel Rate |
| --- | --- | --- | --- | ---: | ---: |
| home | / | 227x1024 | 393x852 | 25.23 | 12.79% |
| ward | /patients | 378x1024 | 393x852 | 15.13 | 4.8% |
| ward-detail | /ward/ward-a | 378x1024 | 393x852 | 20.86 | 9.26% |
| patient-detail | /patient/p1 | 393x1007 | 393x852 | 25.1 | 13.2% |
| profile | /settings | 393x852 | 393x852 | 14.83 | 5.66% |

## Captured Text

## Manual Findings

### Home

- Header is close in layout, but the app lost the Figma photographic/texture background and uses a flat gradient.
- The Figma home screen shows two filled urgent alert cards and patient dispense cards; the app capture only shows an empty urgent-alert section and starts the patient section below the fold.
- Figma stats use `154` and `34`; app data shows `3` and `0`, so visual density and hierarchy differ.
- Action icons are close in placement, but not exact to the Figma icon artwork.

### Ward

- Figma shows four ward cards and summary values `54 / 4`; app shows one live-data ward card and `3 / 1`.
- Header background is materially different: Figma has pill/medical imagery and a stronger top status bar treatment; app uses a simplified geometric gradient.
- Ward card icon differs from the Figma hospital thumbnail.
- Overall vertical density is too sparse compared with Figma because the app has fewer cards.

### Ward Detail

- Figma has a real hallway image hero; app uses an abstract gradient. This is the largest mismatch.
- Figma summary values are `16 / 12 / 4`; app shows `3 / 0 / 3`.
- Figma patient list has five specific demo patients; app shows live/fallback records with different names and fewer visible rows.
- Search/sort row is close structurally, but the top hero and card data state make the screen feel off-design.

### Patient Detail

- This is one of the closest screens structurally.
- Hero art still differs: app uses the simplified gradient/shape background instead of Figma's background texture.
- App crops the medication list earlier because the fixed bottom Add Medication button covers more of the first viewport.
- Tab labels overflow/truncate differently (`Appointm...`) compared with Figma.

### Profile

- Layout is close, but Figma has a real profile photo and healthcare background illustration; app shows initials and flat gradient.
- App profile text is `PILLo Dev User / Administrator` while Figma is `Peeraya / Nurse Manager`, changing visual balance.
- Menu/list spacing and bottom nav are close enough for first-pass implementation.

### home

Good Evening PILLo  Sun, April 26, 2026 • Evening dose  Total Recipients  3  Distributed Today  0   Needs Attention 14  Double Check Scan Medication Low Stock Order ⚠️ Urgent Alerts  View All 💊 Patients to Dispense Medication  All Wards  Ward A (Floor 1)  Ward B Malee Sukjai  Room 103 • Age 70 • Ward 11111111-1111-1111-1111-111111111111  24 tablets Urgent Medication has been changed - please check before dispensing

### ward

Ward 3 Patients 1 Ward Ward 謇  Building 1, Floor 2 - Somying  Dinner Dose  3 Patients 0 Successfully 14 Pending Home Ward Profile

### ward-detail

 Ward A  Building 1, Floor 2 - Somying 3 Patients 0 Successfully 3 Pending Patients Dispense   Malee Sukjai Room 103 • Age 70 1 tablets  Urgent  Prasert Nanta Room 102 • Age 77 3 tablets  Urgent  Sommai Wongdee Room 101 • Age 76 4 tablets  Urgent  Home Ward  Profile

### patient-detail

 Patients Detail Mrs. Somsri Phakrammongkol  Room A-101 • Age 79 9 tablets Mrs. Somsri Phakrammongkol 16 Type 12 Dose/Day 4 End Date Medication Appointments Device Amlodipine 5 mg 1 tablet  Before bedtime  Morning Noon Evening Night  3 days left · Ends on Mar 14 Medication will run out before the next refill Set Reminder Metoprolol 25 mg 1 tablet  Before bedtime  Morning Noon Evening Night  25 days left Risperidone 2 mg 1

### profile

PD  PILLo Dev User  Administrator  Edit Profile Main Menu  Dispensing Report   Notifications  System  Settings   Change Password  Logout Version 1.1.2 Home Ward Profile
