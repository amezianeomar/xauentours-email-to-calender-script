# XauenTours Email to Calendar Script

This Google Apps Script automates OTA reservation handling by reading Gmail messages, extracting booking details, and creating matching Google Calendar events.

## What the script does

The script watches three OTA sources:

- GetYourGuide (GYG)
- Bokun / Viator / partner bookings
- Civitatis

For each supported email, it:

- scans Gmail using source-specific search queries
- keeps processing inside a limited time window to avoid re-reading old mail
- extracts booking data with source-specific parsing rules
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
- `parseBokunEmail()` handles Bokun / Viator-style messages and creates pale green events.
- `parseCivitatisEmail()` handles Civitatis messages and creates red events.

## Rules to keep stable

- Do not modify the duplicate-checking logic unless there is a critical production reason.
- Keep the source-specific date parsing logic intact.
- Keep the current calendar colors:
  - GYG: `YELLOW`
  - Bokun: `PALE_GREEN`
  - Civitatis: `RED`
- Always sanitize plain text before regex extraction when processing Gmail bodies.

## Workflow log

This section must be updated every time the script is modified, audited, or pushed.

### 2026-05-13

- Created the README for the `xaouentours-email-to-calender-script` folder.
- Documented the automation goal, core architecture, and source-specific parsing rules.
- Added a workflow log so future edits can be tracked from the beginning.
- Completed an initial Git push to `origin main` after the project setup.

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
