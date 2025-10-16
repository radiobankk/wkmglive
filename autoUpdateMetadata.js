const fs = require("fs");
const path = require("path");

// Load full schedule
const fullSchedule = require("./schedule.json").schedule;

// Convert "HH:MM" → minutes since midnight
function timeToMinutes(time) {
const [h, m] = time.split(":").map(Number);
return h * 60 + m;
}

// Get current program metadata
function getCurrentProgramMetadata() {
const now = new Date(); // local server time
const nowMinutes = now.getHours() * 60 + now.getMinutes();

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const today = dayNames[now.getDay()];

let todaySchedule = fullSchedule[today];

// Handle "same as Monday"
if (typeof todaySchedule === "string" && todaySchedule.includes("same as")) {
const refDay = todaySchedule.split("same as ")[1];
todaySchedule = fullSchedule[refDay];
}

if (!Array.isArray(todaySchedule)) return defaultMetadata();

// Find current slot
for (let i = 0; i < todaySchedule.length; i++) {
const slot = todaySchedule[i];
const nextSlot = todaySchedule[i + 1];

const slotMinutes = timeToMinutes(slot.time);
const nextSlotMinutes = nextSlot ? timeToMinutes(nextSlot.time) : 24 * 60;

if (nowMinutes >= slotMinutes && nowMinutes < nextSlotMinutes) {
return {
title: slot.title,
comment: `Now Playing: ${slot.title}`,
artwork: slot.artwork || defaultArtwork()
};
}
}

return defaultMetadata();
}

// Default metadata
function defaultMetadata() {
return {
title: "We're Be Right Back!",
comment: "Live MP3 Relay / 192K",
artwork: defaultArtwork()
};
}

// Default artwork
function defaultArtwork() {
return "https://cdn.discordapp.com/attachments/1428212641083424861/1428217755752202260/IMG_9234.png?ex=68f25baf&is=68f10a2f&hm=373514a772bf78ebfcd1b4c6316a637a5eeac0005cf050907a151cdfadebf689&";
}

// Path to currentMetadata.json
const metadataPath = path.join(__dirname, "currentMetadata.json");

// Update metadata every second
setInterval(() => {
const meta = getCurrentProgramMetadata();

try {
fs.writeFileSync(metadataPath, JSON.stringify(meta, null, 2));
console.log(`[${new Date().toLocaleTimeString()}] Updated metadata: ${meta.title}`);
} catch (err) {
console.error("Failed to write metadata:", err);
}
}, 1000);

console.log("✅ autoUpdateMetadata.js running — updating metadata every 1 second.");