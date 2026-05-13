/**
 * XauenTours - Master OTA Automation v2.0 (22-Hour Live Beta)
 * Covers: GetYourGuide, Viator/Bokun, Civitatis + Auto-Cancellations
 *
 * Architecture guardrails:
 * - Keep checkAndCreateEvent duplicate logic untouched (production failsafe).
 * - Keep OTA-specific date parsing strategies (Bokun/Civitatis non-ISO formats).
 * - Dynamic Calendar colors: RED (GYG), GREEN/Basil (VIA), MAUVE/Grape (BCE), RED (Civitatis).
 * - Always sanitize plain text by removing asterisks before regex matching.
 */

// ==========================================
// 🚀 1. THE LAUNCHER & KILL SWITCH
// ==========================================

function start22HourTrigger() {
  // Clear any existing triggers so we don't accidentally run twice at the same time
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  
  // Create the 5-minute heartbeat
  ScriptApp.newTrigger('runAllOTAs')
           .timeBased()
           .everyMinutes(5)
           .create();
           
  // Set the Kill Switch for exactly 22 hours from the moment you click "Run"
  const now = new Date();
  const killTime = now.getTime() + (22 * 60 * 60 * 1000); 
  PropertiesService.getScriptProperties().setProperty('KILL_TIME', killTime.toString());
  
  console.log(`🚀 LAUNCHED! The automation will run every 5 minutes and will self-destruct in 22 hours.`);
}

// ==========================================
// 🧠 2. THE MASTER ENGINE
// ==========================================

function runAllOTAs() {
  const now = new Date().getTime();
  const killTimeStr = PropertiesService.getScriptProperties().getProperty('KILL_TIME');
  
  // THE KILL SWITCH CHECK
  if (killTimeStr && now > parseInt(killTimeStr)) {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(t => ScriptApp.deleteTrigger(t));
    console.log("🛑 22-Hour Beta Complete. Triggers have successfully self-destructed.");
    return;
  }

  // Define the dynamic time window: Only look at emails from the last 2 hours
  const windowStart = now - (2 * 60 * 60 * 1000); 
  const windowEnd = now;

  const calendarId = 'xauentours@gmail.com'; 
  const calendar = CalendarApp.getCalendarById(calendarId);

  // We use yesterday's date for the Gmail search string to keep the search lightning fast
  const yesterday = new Date(now - (24 * 60 * 60 * 1000));
  const dateString = Utilities.formatDate(yesterday, "GMT+1", "yyyy/MM/dd");

  console.log("⚙️ Master Engine Syncing...");

  console.log("⚙️ Master Engine Syncing Bookings & Cancellations...");

  // Run the 3 Booking Parsers
  processGYG(calendar, windowStart, windowEnd, dateString);
  processBokun(calendar, windowStart, windowEnd, dateString);
  processCivitatis(calendar, windowStart, windowEnd, dateString);

  // Run the Universal Cancellation Engine
  processCancellations(calendar, windowStart, windowEnd, dateString);
}

// ==========================================
// 🗑️ 3. THE CANCELLATION ENGINE
// ==========================================

function processCancellations(calendar, windowStart, windowEnd, dateString) {
  const query = `(subject:"cancel" OR subject:"annulation" OR subject:"cancellation" OR subject:"anulada") (from:getyourguide OR from:bokun OR from:civitatis) after:${dateString}`;
  const threads = GmailApp.search(query);

  const searchStart = new Date();
  searchStart.setMonth(searchStart.getMonth() - 1);
  const searchEnd = new Date();
  searchEnd.setFullYear(searchEnd.getFullYear() + 1);

  threads.forEach(thread => {
    thread.getMessages().forEach(message => {
      const msgTime = message.getDate().getTime();

      if (msgTime >= windowStart && msgTime <= windowEnd) {
        const cleanBodyText = message.getPlainBody().replace(/\*/g, '');
        let refToCancel = null;

        const gygMatch = cleanBodyText.match(/Numéro de référence[\s\S]*?(GYG[A-Z0-9]+)/i);
        if (gygMatch) refToCancel = gygMatch[1].trim();

        if (!refToCancel) {
          const bokunMatch = cleanBodyText.match(/Booking\s*ref[\.\:\s]*([A-Z0-9\-]+)/i);
          if (bokunMatch) refToCancel = bokunMatch[1].trim();
        }

        if (!refToCancel) {
          const civMatch = cleanBodyText.match(/Reservation number:\s*([A-Z0-9]+)/i);
          if (civMatch) refToCancel = civMatch[1].trim();
        }

        if (refToCancel && refToCancel !== "NO-REF") {
          const eventsToDelete = calendar.getEvents(searchStart, searchEnd, { search: refToCancel });
          eventsToDelete.forEach(event => {
            console.log(`🚨 CANCELLATION PROCESSED: Deleting event for Ref ${refToCancel}`);
            event.deleteEvent();
          });
        }
      }
    });
  });
}

// ==========================================
// 🏭 4. THE OTA PROCESSORS
// ==========================================

function processGYG(calendar, windowStart, windowEnd, dateString) {
  const query = `from:notification.getyourguide.com subject:"Nouvelle réservation" after:${dateString}`;
  const threads = GmailApp.search(query);

  threads.forEach(thread => {
    thread.getMessages().forEach(message => {
      const msgTime = message.getDate().getTime();
      if (msgTime >= windowStart && msgTime <= windowEnd) {
        const data = parseGYGEmail(message.getPlainBody());
        if (data && data.reference) checkAndCreateEvent(calendar, data, createGYGEvent);
      }
    });
  });
}

function processBokun(calendar, windowStart, windowEnd, dateString) {
  const query = `(from:bokun OR subject:"New booking") after:${dateString}`;
  const threads = GmailApp.search(query);

  threads.forEach(thread => {
    thread.getMessages().forEach(message => {
      const msgTime = message.getDate().getTime();
      if (msgTime >= windowStart && msgTime <= windowEnd) {
        const data = parseBokunEmail(message.getPlainBody(), message.getSubject());
        if (data && data.reference && data.reference !== "NO-REF") {
          checkAndCreateEvent(calendar, data, createBokunEvent);
        }
      }
    });
  });
}

function processCivitatis(calendar, windowStart, windowEnd, dateString) {
  const query = `from:notificaciones@civitatis.com subject:"New booking" after:${dateString}`;
  const threads = GmailApp.search(query);

  threads.forEach(thread => {
    thread.getMessages().forEach(message => {
      const msgTime = message.getDate().getTime();
      if (msgTime >= windowStart && msgTime <= windowEnd) {
        const data = parseCivitatisEmail(message.getPlainBody());
        if (data && data.reference) checkAndCreateEvent(calendar, data, createCivitatisEvent);
      }
    });
  });
}

// ==========================================
// 🛡️ 5. THE DUPLICATE CHECKER (Universal)
// ==========================================

function checkAndCreateEvent(calendar, data, createFunction) {
  const existingEvents = calendar.getEvents(
    new Date(data.startTime.getTime() - 600000), 
    new Date(data.startTime.getTime() + 600000)
  );

  const isDuplicate = existingEvents.some(event => event.getTitle().includes(data.reference));

  if (!isDuplicate) {
    createFunction(calendar, data);
  }
}

// ==========================================
// ✂️ 6. THE PARSERS & EVENT BUILDERS
// ==========================================

// --- GET YOUR GUIDE ---
function parseGYGEmail(body) {
  try {
    const cleanBodyText = body.replace(/\*/g, '');
    const refMatch = cleanBodyText.match(/Numéro de référence[\s\S]*?(GYG[A-Z0-9]+)/i);
    const dateMatch = cleanBodyText.match(/Date[\s\S]*?([A-Za-zÀ-ÿ]+ \d{1,2}, \d{4} \d{1,2}:\d{2}\s*[AP]M)/i);
    const pickupMatch = cleanBodyText.match(/Pickup[\r\n]+\s*([\s\S]*?)(?:Ouvrir dans Google Maps|Prix|$)/i);
    const tourMatch = cleanBodyText.match(/une réservation[\s\S]*?:[\r\n\s]*(?:\[image:.*?\][\r\n\s]*)?([^\r\n]+)/i);

    if (!refMatch || !dateMatch) return null;
    const startTime = new Date(dateMatch[1].trim());
    return {
      reference: refMatch[1].trim(),
      startTime: startTime,
      endTime: new Date(startTime.getTime() + (60 * 60 * 1000)),
      pickup: pickupMatch ? pickupMatch[1].trim() : "Lieu de ramassage à vérifier",
      title: `${tourMatch ? tourMatch[1].trim() : "GetYourGuide Tour"} Visite partagée ticket-booking Numéro de référence ${refMatch[1].trim()}`,
      description: cleanBodyText.replace(/\[image:.*?\]/g, "").replace(/<https?:\/\/[^>]+>/g, "").trim()
    };
  } catch (e) { return null; }
}

function createGYGEvent(calendar, data) {
  const event = calendar.createEvent(data.title, data.startTime, data.endTime, { location: data.pickup, description: data.description });
  event.setColor(CalendarApp.EventColor.RED);
}

// --- VIATOR / BOKUN ---
function parseBokunEmail(body, subject) {
  try {
    const cleanBodyText = body.replace(/\*/g, '');
    const refMatch = cleanBodyText.match(/Booking\s*ref[\.\:\s]*([A-Z0-9\-]+)/i);
    const tourMatch = cleanBodyText.match(/Product\s+(?!booking\s*ref)([^\n\r]+)/i);
    const pickupMatch = cleanBodyText.match(/Pick-up\s+([^\n\r]+)/i);
    const soldByMatch = cleanBodyText.match(/Sold\s*by[\s\:]*([^\n\r]+)/i);
    const channelMatch = cleanBodyText.match(/Booking\s*channel[\s\:]*([^\n\r]+)/i);

    let dateStr = "";
    const subjectDateMatch = subject.match(/([A-Za-z]{3}\s\d{1,2}\.[A-Za-z]{3}\s\'\d{2}\s@\s\d{2}:\d{2})/i);
    const bodyDateMatch = cleanBodyText.match(/Date\s*([A-Za-z]{3}\s\d{1,2}\.[A-Za-z]{3}\s\'\d{2}\s@\s\d{2}:\d{2})/i);

    if (subjectDateMatch) dateStr = subjectDateMatch[1];
    else if (bodyDateMatch) dateStr = bodyDateMatch[1];
    else return null; 

    const parts = dateStr.split(' '); 
    const cleanDateStr = `${parts[1].split('.')[1]} ${parts[1].split('.')[0]}, ${parts[2].replace("'", "20")} ${parts[4]}`;
    const startTime = new Date(cleanDateStr);
    
    let descStart = cleanBodyText.indexOf("Customer"); 
    if (descStart === -1) descStart = cleanBodyText.indexOf("Product");
    let rawDesc = descStart !== -1 ? cleanBodyText.substring(descStart) : cleanBodyText;
    let footerIdx = rawDesc.indexOf("Want $50");
    if(footerIdx !== -1) rawDesc = rawDesc.substring(0, footerIdx);

    const ref = refMatch ? refMatch[1].trim() : "NO-REF";
    const soldBy = soldByMatch ? soldByMatch[1].trim() : "Viator.com";
    const channel = channelMatch ? channelMatch[1].trim() : "Viator.com";

    return {
      reference: ref,
      startTime: startTime,
      endTime: new Date(startTime.getTime() + (60 * 60 * 1000)),
      pickup: pickupMatch ? pickupMatch[1].trim() : "Lieu de ramassage à vérifier",
      title: `${tourMatch ? tourMatch[1].trim() : "Bokun Tour"} Supplier Xauen Tours Sold by ${soldBy} Booking channel ${channel} Ref: ${ref}`,
      description: rawDesc.replace(/<https?:\/\/[^>]+>/g, "").trim()
    };
  } catch (e) { return null; }
}

function createBokunEvent(calendar, data) {
  const event = calendar.createEvent(data.title, data.startTime, data.endTime, { location: data.pickup, description: data.description });

  if (data.reference.startsWith("VIA")) {
    event.setColor(CalendarApp.EventColor.GREEN);
  } else if (data.reference.startsWith("BCE")) {
    event.setColor(CalendarApp.EventColor.MAUVE);
  } else {
    event.setColor(CalendarApp.EventColor.PALE_GREEN);
  }
}

// --- CIVITATIS ---
function parseCivitatisEmail(body) {
  try {
    const cleanBodyText = body.replace(/\*/g, '');
    const actMatch = cleanBodyText.match(/Activity:\s*([^\n\r]+)/i);
    const refMatch = cleanBodyText.match(/Reservation number:\s*([A-Z0-9]+)/i);
    const cityMatch = cleanBodyText.match(/City:\s*([^\n\r]+)/i);
    const langMatch = cleanBodyText.match(/Language:\s*([^\n\r]+)/i);
    const codeMatch = cleanBodyText.match(/Internal code:\s*([^\n\r]+)/i);
    const dateMatch = cleanBodyText.match(/Date:\s*([^\n\r]+)/i);
    const timeMatch = cleanBodyText.match(/Hour:\s*([\d:]+)/i); 
    const pickupMatch = cleanBodyText.match(/Pickup point:\s*([^\n\r]+)/i);

    if (!refMatch || !dateMatch || !timeMatch) return null;

    let rawDate = dateMatch[1].trim(); 
    if (rawDate.includes(",")) rawDate = rawDate.substring(rawDate.indexOf(",") + 1).trim(); 
    const startTime = new Date(`${rawDate} ${timeMatch[1]}`);

    const descStartMatch = cleanBodyText.match(/Activity:/i);
    const descEndMatch = cleanBodyText.match(/Client details/i);
    let rawDesc = cleanBodyText.substring(
      descStartMatch ? descStartMatch.index : 0, 
      descEndMatch ? descEndMatch.index : cleanBodyText.length
    ).trim();

    return {
      reference: refMatch[1].trim(),
      startTime: startTime,
      endTime: new Date(startTime.getTime() + (60 * 60 * 1000)),
      pickup: pickupMatch ? pickupMatch[1].trim() : "Lieu de ramassage",
      title: `${actMatch ? actMatch[1].trim() : "Civitatis Tour"} Reservation number: ${refMatch[1].trim()} City: ${cityMatch ? cityMatch[1].trim() : ""} Language: ${langMatch ? langMatch[1].trim() : ""} Internal code: ${codeMatch ? codeMatch[1].trim() : ""} Date: ${dateMatch[1].trim()}`,
      description: rawDesc.replace(/\[?https?:\/\/[^\]\s]+\]?/gi, "").trim()
    };
  } catch (e) { return null; }
}

function createCivitatisEvent(calendar, data) {
  const event = calendar.createEvent(data.title, data.startTime, data.endTime, { location: data.pickup, description: data.description });
  event.setColor(CalendarApp.EventColor.RED);
}