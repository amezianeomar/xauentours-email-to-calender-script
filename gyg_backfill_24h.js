/**
 * XauenTours - GetYourGuide 24h Backfill
 *
 * Run this once manually to recover missed GYG bookings from the last 24 hours.
 * It reuses the main project's parseGYGEmail(), checkAndCreateEvent(), and createGYGEvent().
 */

function backfillGYGReservations24h() {
  // Ensure audit constants exist even if this file runs without the full main script constants block.
  if (typeof AUDIT_SHEET_PROPERTY_KEY === 'undefined') {
    globalThis.AUDIT_SHEET_PROPERTY_KEY = 'AUDIT_SHEET_ID';
  }
  if (typeof AUDIT_SHEET_NAME === 'undefined') {
    globalThis.AUDIT_SHEET_NAME = 'XauenTours Audit Trail';
  }

  const now = Date.now();
  const windowStart = now - (24 * 60 * 60 * 1000);
  const windowEnd = now;
  const calendar = CalendarApp.getCalendarById('xauentours@gmail.com');

  if (!calendar) {
    console.log('🛑 Backfill GYG: calendar not found.');
    return;
  }

  const yesterday = new Date(windowStart);
  const dateString = Utilities.formatDate(yesterday, 'GMT+1', 'yyyy/MM/dd');
  const query = 'from:notification.getyourguide.com (subject:"Réservation" OR subject:"Nouvelle réservation") after:' + dateString;
  const threads = GmailApp.search(query);

  let processed = 0;
  let created = 0;

  threads.forEach(thread => {
    thread.getMessages().forEach(message => {
      const msgTime = message.getDate().getTime();
      if (msgTime < windowStart || msgTime > windowEnd) return;

      processed++;
      const data = parseGYGEmail(message.getPlainBody());
      if (data && data.reference) {
        const before = calendar.getEvents(
          new Date(data.startTime.getTime() - 600000),
          new Date(data.startTime.getTime() + 600000)
        ).length;

        checkAndCreateEvent(calendar, data, createGYGEvent);

        const after = calendar.getEvents(
          new Date(data.startTime.getTime() - 600000),
          new Date(data.startTime.getTime() + 600000)
        ).length;

        if (after > before) created++;
      }
    });
  });

  console.log('✅ Backfill GYG complete. Messages scanned: ' + processed + ' | Events created: ' + created);
}
