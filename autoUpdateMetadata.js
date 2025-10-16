const fs = require("fs");
const path = require("path");

// Load full schedule
const schedule = require("./schedule.json").schedule;

// Path to write current metadata for the stream
const metadataFile = path.join(__dirname, "currentMetadata.json");

// Function to get current program based on local time
function getCurrentProgram() {
const now = new Date();
const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const today = dayNames[now.getDay()];

let todaySchedule = schedule[today];

// Handle "same as Monday" references
if (typeof todaySchedule === "string" && todaySchedule.includes("same as")) {
const refDay = todaySchedule.split("same as ")[1];
todaySchedule = schedule[refDay];
}

if (!Array.isArray(todaySchedule)) {
return defaultMetadata();
}

// Find the current slot
for (let i = 0; i < todaySchedule.length; i++) {
const slot = todaySchedule[i];
const nextSlot = todaySchedule[i + 1];

if (currentTime >= slot.time && (!nextSlot || currentTime < nextSlot.time)) {
return {
title: slot.title,
comment: `Now Playing: ${slot.title} | WKMG-DT1`,
artwork: slot.artwork || "https://cdn.discordapp.com/attachments/1428212641083424861/1428217755752202260/IMG_9234.png?ex=68f25baf&is=68f10a2f&hm=373514a772bf78ebfcd1b4c6316a637a5eeac0005cf050907a151cdfadebf689&"
};
}
}

return defaultMetadata();
}

// Default metadata if no program is found
function defaultMetadata() {
return {
title: "News 6",
comment: "Live MP3 Relay / 192K",
artwork: "https://cdn.discordapp.com/attachments/1428212641083424861/1428217755752202260/IMG_9234.png?ex=68f25baf&is=68f10a2f&hm=373514a772bf78ebfcd1b4c6316a637a5eeac0005cf050907a151cdfadebf689&"
};
}

// Function to update metadata JSON file
function updateMetadataFile() {
const meta = getCurrentProgram();

fs.writeFile(metadataFile, JSON.stringify(meta, null, 2), err => {
if (err) {
console.error("Failed to update metadata:", err);
} else {
console.log(`[${new Date().toLocaleTimeString()}] Metadata updated: ${meta.title}`);
}
});
}

// Run every 1 second
setInterval(updateMetadataFile, 1000);

// Initial run
updateMetadataFile();
console.log("✅ Metadata updater running, updating every 1 second...");