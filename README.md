# XauenTours Email to Calendar Script

This Google Apps Script automates OTA reservation handling by reading Gmail messages, extracting booking details, creating matching Google Calendar events, and deleting matching bookings when cancellation emails arrive.

Current implementation: XauenTours - Master OTA Automation v2.0 (22-Hour Live Beta).

## What the script does

The script watches three OTA sources and a cancellation stream:

- GetYourGuide (GYG)
- Bokun / Viator / partner bookings
- Civitatis
- OTA cancellation emails across the supported sources

For each supported email, it:

- scans Gmail using source-specific search queries
- keeps processing inside a limited time window to avoid re-reading old mail
- extracts booking data with source-specific parsing rules
- detects cancellation emails and deletes matching calendar events by reference
- cleans the message body by removing noise such as asterisks, image tags, and tracking links
- creates a Google Calendar event with the correct title, time, pickup location, description, and color
- checks for duplicates before creating the event

## Core architecture

### 1. Launcher and kill switch

`start22HourTrigger()` creates a 5-minute trigger and stores a `KILL_TIME` value so the beta run ends automatically after 22 hours.

### 2. Master engine

`runAllOTAs()` checks the kill switch, defines the time window, loads the calendar, and runs the three OTA processors.

### 3. Duplicate protection

`checkAndCreateEvent()` queries Google Calendar around the target time and skips event creation when the reference already exists.

### 4. Parsing engines

- `parseGYGEmail()` handles GetYourGuide messages and creates yellow events.
- `parseBokunEmail()` handles Bokun / Viator-style messages and creates dynamic colors based on the booking reference prefix.
- `parseCivitatisEmail()` handles Civitatis messages and creates red events.

### 5. Cancellation engine

`processCancellations()` scans for cancellation keywords in Gmail, extracts the booking reference, and removes matching calendar events from the search window.

## Rules to keep stable

- Do not modify the duplicate-checking logic unless there is a critical production reason.
- Keep the source-specific date parsing logic intact.
- Keep the current calendar colors:
  - GYG: `RED`
  - Bokun: `GREEN` for VIA references, `MAUVE` for BCE references, fallback `PALE_GREEN`
  - Civitatis: `RED`
- Always sanitize plain text before regex extraction when processing Gmail bodies.

## Workflow log

This section must be updated every time the script is modified, audited, or pushed.

### 2026-05-13

- Created the README for the `xaouentours-email-to-calender-script` folder.
- Documented the automation goal, core architecture, and source-specific parsing rules.
- Added a workflow log so future edits can be tracked from the beginning.
- Completed an initial Git push to `origin main` after the project setup.
- Updated the automation to v2.0 with cancellation handling, dynamic Bokun colors, and a new Gmail query for GYG bookings.
- Verified the updated script syntax locally before recording this change.
- Prepared the updated workflow for the next push cycle.
- Second update in the same session: aligned the script with the official CalendarApp color enum, replacing unsupported `PLUM` usage with `MAUVE`.
- Audited the updated script again after the color fix; syntax check passed.
- Pushed the v2.0 update to `origin main` after the final audit.

## Workflow tracking rule

For every future change, add a new entry here with:

- date
- what was modified
- what was audited or verified
- whether the change was pushed
- any important notes or risks

## Repository notes

- Main script file: `xauentours-email-to-calender-script.js`
- Git remote push has already been completed to `origin main`
- The workflow log should be extended again after the next audit or push.
